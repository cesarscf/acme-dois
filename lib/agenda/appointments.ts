import { and, asc, eq, gte, lt } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { Restore } from "../agent/cards"
import { db } from "../db"
import { appointment, customer, member as memberTable, user } from "../db/schema"
import type { Member } from "../member"

// What a new appointment lasts unless someone says otherwise.
export const defaultAppointmentMinutes = 50

export type Appointment = typeof appointment.$inferSelect

// One change to a session: booked (no `from`), cancelled (no `to`), or moved to another time or
// member. A rescheduling is one change, from the cancelled session to the one booked in its place.
export type AgendaChange = { from: Appointment | null; to: Appointment | null }

const inOrganization = (member: Member, id: string) =>
  and(eq(appointment.id, id), eq(appointment.organizationId, member.organizationId))

const attending = alias(memberTable, "attending")

// An organization's appointments in [from, to), with the customer's and the attending member's names.
export async function listAppointments(member: Member, range: { from: Date; to: Date }) {
  return db
    .select({
      id: appointment.id,
      startsAt: appointment.startsAt,
      durationMinutes: appointment.durationMinutes,
      kind: appointment.kind,
      status: appointment.status,
      customerId: appointment.customerId,
      customer: customer.name,
      memberId: appointment.memberId,
      attendedBy: user.name,
    })
    .from(appointment)
    .innerJoin(customer, eq(customer.id, appointment.customerId))
    .leftJoin(attending, eq(attending.id, appointment.memberId))
    .leftJoin(user, eq(user.id, attending.userId))
    .where(
      and(
        eq(appointment.organizationId, member.organizationId),
        gte(appointment.startsAt, range.from),
        lt(appointment.startsAt, range.to),
      ),
    )
    .orderBy(asc(appointment.startsAt))
}

export async function findAppointment(member: Member, id: string) {
  const [found] = await db.select().from(appointment).where(inOrganization(member, id))
  return found
}

async function isOrganizationMember(organizationId: string, memberId: string) {
  const [found] = await db
    .select({ id: memberTable.id })
    .from(memberTable)
    .where(and(eq(memberTable.id, memberId), eq(memberTable.organizationId, organizationId)))
  return Boolean(found)
}

export class AgendaError extends Error {}

export type NewAppointment = {
  customerId: string
  memberId: string | null
  startsAt: Date
  durationMinutes?: number
  kind?: string | null
}

export async function createAppointment(member: Member, input: NewAppointment) {
  const [[owner], attends] = await Promise.all([
    db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.id, input.customerId), eq(customer.organizationId, member.organizationId))),
    input.memberId ? isOrganizationMember(member.organizationId, input.memberId) : true,
  ])
  if (!owner) throw new AgendaError("Essa cliente não é da clínica.")
  if (!attends) throw new AgendaError("Quem atende precisa ser da equipe.")
  const [created] = await db
    .insert(appointment)
    .values({
      organizationId: member.organizationId,
      customerId: input.customerId,
      memberId: input.memberId,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes ?? defaultAppointmentMinutes,
      kind: input.kind?.trim() || null,
    })
    .returning()
  return created
}

// A scheduled appointment of the organization, or an AgendaError saying why not.
async function scheduled(member: Member, id: string) {
  const found = await findAppointment(member, id)
  if (!found) throw new AgendaError("Essa sessão não existe na agenda.")
  if (found.status !== "scheduled") throw new AgendaError("Essa sessão não está mais agendada.")
  return found
}

// Cancels the appointment and books a new one in its place. The member attending stays unless
// another is given.
export async function rescheduleAppointment(
  member: Member,
  id: string,
  to: { startsAt: Date; memberId?: string | null },
) {
  const from = await scheduled(member, id)
  const memberId = to.memberId === undefined ? from.memberId : to.memberId
  if (memberId && !(await isOrganizationMember(member.organizationId, memberId)))
    throw new AgendaError("Quem atende precisa ser da equipe.")
  return db.transaction(async (tx) => {
    const [cancelled] = await tx
      .update(appointment)
      .set({ status: "cancelled" })
      .where(and(inOrganization(member, id), eq(appointment.updatedAt, from.updatedAt)))
      .returning()
    if (!cancelled) throw new AgendaError("Essa sessão mudou enquanto eu remarcava.")
    const [rebooked] = await tx
      .insert(appointment)
      .values({
        organizationId: member.organizationId,
        customerId: from.customerId,
        memberId,
        startsAt: to.startsAt,
        durationMinutes: from.durationMinutes,
        kind: from.kind,
        rescheduledFromId: from.id,
      })
      .returning()
    return { cancelled, rebooked }
  })
}

export async function assignAppointment(member: Member, id: string, memberId: string) {
  const [from, attends] = await Promise.all([scheduled(member, id), isOrganizationMember(member.organizationId, memberId)])
  if (from.memberId === memberId) throw new AgendaError("Essa pessoa já atende essa sessão.")
  if (!attends) throw new AgendaError("Quem atende precisa ser da equipe.")
  const [updated] = await db
    .update(appointment)
    .set({ memberId })
    .where(and(inOrganization(member, id), eq(appointment.updatedAt, from.updatedAt)))
    .returning()
  if (!updated) throw new AgendaError("Essa sessão mudou enquanto eu trocava quem atende.")
  return { from, updated }
}

// Cancelling is final: rescheduling books a new appointment instead of reopening this one.
// `stale` when the appointment is no longer scheduled at the version `unchangedSince`.
export async function cancelAppointment(
  member: Member,
  id: string,
  unchangedSince?: Date,
): Promise<Appointment | "stale"> {
  const [cancelled]: (Appointment | undefined)[] = await db
    .update(appointment)
    .set({ status: "cancelled" })
    .where(
      and(
        inOrganization(member, id),
        eq(appointment.status, "scheduled"),
        unchangedSince ? eq(appointment.updatedAt, unchangedSince) : undefined,
      ),
    )
    .returning()
  return cancelled ?? "stale"
}

// Puts every restore back, or none: `stale` when any appointment changed since. Otherwise each
// appointment as it was and as it is now.
export async function applyRestores(member: Member, restores: Restore[]) {
  try {
    return await db.transaction(async (tx) => {
      const restored: { before: Appointment; after: Appointment }[] = []
      for (const { id, updatedAt, restore } of restores) {
        const atVersion = and(inOrganization(member, id), eq(appointment.updatedAt, new Date(updatedAt)))
        const [before] = await tx.select().from(appointment).where(atVersion).for("update")
        const [after] = before ? await tx.update(appointment).set(restore).where(atVersion).returning() : []
        if (!before || !after) throw new StaleRestore()
        restored.push({ before, after })
      }
      return restored
    })
  } catch (error) {
    if (error instanceof StaleRestore) return "stale"
    throw error
  }
}

// What undoing changed, as changes: a session cancelled and another put back is one rescheduling.
export function changesOfRestores(restored: { before: Appointment; after: Appointment }[]): AgendaChange[] {
  const isScheduled = (version: Appointment) => version.status === "scheduled"
  const lost = restored.filter(({ before, after }) => isScheduled(before) && !isScheduled(after)).map(({ before }) => before)
  const gained = restored.filter(({ before, after }) => !isScheduled(before) && isScheduled(after)).map(({ after }) => after)
  const moved = restored
    .filter(({ before, after }) => isScheduled(before) && isScheduled(after))
    .map(({ before, after }) => ({ from: before, to: after }))
  if (lost.length === 1 && gained.length === 1) return [{ from: lost[0], to: gained[0] }, ...moved]
  return [...lost.map((from) => ({ from, to: null })), ...gained.map((to) => ({ from: null, to })), ...moved]
}

class StaleRestore extends Error {}

// Puts an appointment back as `restore` while it stays at this version.
export const restoreOf = (version: Appointment, restore: Restore["restore"]): Restore => ({
  id: version.id,
  updatedAt: version.updatedAt.toISOString(),
  restore,
})
