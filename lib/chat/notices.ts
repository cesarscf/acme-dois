import type { AgendaChange, Appointment } from "../agenda/appointments"
import { findCustomer } from "../agenda/customers"
import { listTeam, type Teammate } from "../agenda/team"
import { db } from "../db"
import { message, transcriptEntry } from "../db/schema"
import { type Member, organizationTimeZone } from "../member"
import { appointmentLabel } from "../time"

// When an agent changes the agenda for one member, whoever attends the sessions it changed hears
// about it from that agent, in their own conversation with it. The app writes the notice, not the
// model, and the agent reads it in that conversation's transcript.

// How the change came about: the agent did as asked, a member confirmed it, or undid a receipt.
export type Via = "asked" | "confirmed" | "undone"

export type Notice = { memberId: string; text: string }

const leads: Record<Via, (name: string) => string> = {
  asked: (name) => `A pedido de ${name}, `,
  confirmed: (name) => `Com a confirmação de ${name}, `,
  undone: (name) => `Desfazendo uma mudança a pedido de ${name}, `,
}

// The notices one change sends: to whoever attended it and whoever attends it now, but never to the
// member who made it, and not for a session that is over.
export function noticesOf(
  { from, to }: AgendaChange,
  {
    actor,
    via,
    customer,
    names,
    now,
    timeZone = organizationTimeZone,
  }: {
    actor: Member
    via: Via
    customer: string
    // The team's names by member id; whoever left it hears nothing.
    names: Map<string, string>
    now: Date
    timeZone?: string
  },
): Notice[] {
  const when = (appointment: Appointment) => appointmentLabel(appointment.startsAt, timeZone)
  const lead = leads[via](actor.name)
  const over = [from, to].every((appointment) => !appointment || appointment.startsAt <= now)
  if (over) return []

  const notices: Notice[] = []
  const tell = (memberId: string | null, text: string) => {
    if (memberId && memberId !== actor.id && names.has(memberId)) notices.push({ memberId, text })
  }
  if (!from && to) tell(to.memberId, `${lead}marquei uma sessão para você: ${customer}, ${when(to)} (${to.durationMinutes} min).`)
  else if (from && !to) tell(from.memberId, `${lead}cancelei uma sessão sua: ${customer}, ${when(from)}.`)
  else if (from && to) {
    const moved = from.startsAt.getTime() !== to.startsAt.getTime()
    if (from.memberId === to.memberId) {
      if (moved) tell(to.memberId, `${lead}remarquei uma sessão sua: ${customer}, de ${when(from)} para ${when(to)}.`)
    } else {
      const attending = to.memberId ? names.get(to.memberId) : undefined
      const attended = from.memberId ? names.get(from.memberId) : undefined
      const rescheduled = moved ? `, remarcada para ${when(to)}` : ""
      tell(
        from.memberId,
        attending
          ? `${lead}passei uma sessão sua para ${attending}: ${customer}, ${when(from)}${rescheduled}.`
          : `${lead}tirei você de uma sessão, que ficou sem ninguém para atender: ${customer}, ${when(from)}${rescheduled}.`,
      )
      tell(
        to.memberId,
        `${lead}passei para você uma sessão ${attended ? `que era de ${attended}` : "que estava sem ninguém para atender"}: ${customer}, ${when(to)}${moved ? ` (antes ${when(from)})` : ""}.`,
      )
    }
  }
  return notices
}

// What the agent reads in the conversation it notified, so it knows what it said there.
export const noticeNote = (text: string) =>
  `[Aviso do Acme, não escrito pelo membro] O Acme mandou nesta conversa, em seu nome, este aviso de uma mudança na agenda: "${text}"`

// Sends the agent's notices of what `actor` changed. The change is already made, so a failure here
// is logged, never thrown: it mustn't make the change look as if it failed.
export async function notifyChanges(
  { actor, agentId, via, now }: { actor: Member; agentId: string; via: Via; now: Date },
  changes: AgendaChange[],
  // The team, when the caller has read it already.
  knownTeam?: Teammate[],
) {
  try {
    const [team, customers] = await Promise.all([
      knownTeam ?? listTeam(actor.organizationId),
      Promise.all(changes.map((change) => findCustomer(actor, (change.to ?? change.from)!.customerId))),
    ])
    const names = new Map(team.map((teammate) => [teammate.id, teammate.name]))
    const notices = changes.flatMap((change, index) =>
      noticesOf(change, { actor, via, customer: customers[index]?.name ?? "Cliente", names, now }),
    )
    if (notices.length === 0) return
    await db.transaction(async (tx) => {
      // A millisecond apart, so each conversation lists them in order.
      await tx.insert(message).values(
        notices.map(({ memberId, text }, index) => ({
          memberId,
          agentId,
          author: "agent" as const,
          text,
          createdAt: new Date(now.getTime() + index),
        })),
      )
      await tx
        .insert(transcriptEntry)
        .values(
          notices.map(({ memberId, text }) => ({ memberId, agentId, entry: { role: "user" as const, content: noticeNote(text) } })),
        )
    })
  } catch (failure) {
    console.error("Agenda notices failed", failure)
  }
}
