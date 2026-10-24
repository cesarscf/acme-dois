import { and, eq, gt } from "drizzle-orm"
import { db } from "../db"
import { invitation, member as memberTable, organization, user } from "../db/schema"
import type { Member } from "../member"

// An invite is a link the member shares (there is no email sending), valid for 7 days. Whoever
// opens it must sign in with the invited email to join; Better Auth checks that on accepting.
export const inviteDays = 7

export class InviteError extends Error {}

const normalized = (email: string) => email.trim().toLowerCase()

// Invites an email to the member's organization, or renews its pending invite.
export async function createInvite(member: Member, input: { email: string }, now = new Date()) {
  const email = normalized(input.email)
  const [already] = await db
    .select({ id: memberTable.id })
    .from(memberTable)
    .innerJoin(user, eq(user.id, memberTable.userId))
    .where(and(eq(memberTable.organizationId, member.organizationId), eq(user.email, email)))
  if (already) throw new InviteError(`${email} já faz parte da clínica.`)

  const expiresAt = new Date(now.getTime() + inviteDays * 86_400_000)
  const [pending] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, member.organizationId),
        eq(invitation.email, email),
        eq(invitation.status, "pending"),
      ),
    )
  if (pending) {
    await db.update(invitation).set({ expiresAt, inviterId: member.userId }).where(eq(invitation.id, pending.id))
    return { id: pending.id, email, expiresAt }
  }
  const [created] = await db
    .insert(invitation)
    .values({
      // The id is the link's secret, so it must not be guessable.
      id: crypto.randomUUID(),
      organizationId: member.organizationId,
      email,
      role: "member",
      status: "pending",
      expiresAt,
      createdAt: now,
      inviterId: member.userId,
    })
    .returning({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt })
  return created
}

// What the invite page shows to whoever opens the link.
export async function findInvite(id: string, now = new Date()) {
  const [found] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, id))
  if (!found) return undefined
  const open = found.status === "pending" && found.expiresAt > now
  return { ...found, open }
}

export async function listPendingInvites(member: Member, now = new Date()) {
  return db
    .select({ email: invitation.email, expiresAt: invitation.expiresAt })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, member.organizationId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, now),
      ),
    )
}
