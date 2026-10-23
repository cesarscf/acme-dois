import type Anthropic from "@anthropic-ai/sdk"
import { and, asc, eq } from "drizzle-orm"
import { applyRestores, cancelAppointment } from "../agenda/appointments"
import { listTeam } from "../agenda/team"
import type { Card } from "../agent/cards"
import type { Model } from "../agent/model"
import { turnContext } from "../agent/prompt"
import { type AgentReply, runTurn, unanswered } from "../agent/run-turn"
import { agendaTools, createToolRegistry } from "../agent/tools"
import { db } from "../db"
import { message, transcriptEntry } from "../db/schema"
import { type Member, organizationTimeZone } from "../member"

const tools = createToolRegistry(agendaTools)

// What the member's browser gets: never a card's action.
export async function listMessages(member: Member) {
  return db
    .select({
      id: message.id,
      author: message.author,
      text: message.text,
      card: message.card,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.memberId, member.id))
    .orderBy(asc(message.createdAt))
}

export type ChatMessage = Awaited<ReturnType<typeof listMessages>>[number]

async function transcriptOf(member: Member) {
  const rows = await db
    .select({ entry: transcriptEntry.entry })
    .from(transcriptEntry)
    .where(eq(transcriptEntry.memberId, member.id))
    .orderBy(asc(transcriptEntry.seq))
  return rows.map((row) => row.entry)
}

// Replies are stored a millisecond apart, so they list in the order the agent gave them.
const agentMessages = (member: Member, replies: AgentReply[], after: Date) =>
  replies.map((reply, index) => ({
    memberId: member.id,
    author: "agent" as const,
    createdAt: new Date(after.getTime() + index + 1),
    ...("text" in reply ? { text: reply.text } : { card: reply.card, action: reply.action }),
  }))

// The member writes to the agent and the agent answers, changing the agenda as it goes.
export async function sendMessage(
  member: Member,
  text: string,
  { model, now = new Date() }: { model: Model; now?: Date },
) {
  await db.insert(message).values({ memberId: member.id, author: "member", text, createdAt: now })
  const [transcript, team] = await Promise.all([transcriptOf(member), listTeam(member.organizationId)])
  const asked: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: text },
    {
      role: "system",
      content: turnContext({ speaker: member, team, now, timeZone: organizationTimeZone }),
      clear_at: "next_user_message",
    },
  ]

  let turn
  try {
    turn = await runTurn({
      model,
      tools,
      transcript: [...transcript, ...asked],
      context: { member, now, timeZone: organizationTimeZone },
    })
  } catch (failure) {
    // Nothing reaches the transcript, so the next turn starts from the last complete one.
    console.error("Agent turn failed", failure)
    await db.insert(message).values(agentMessages(member, [{ text: unanswered }], now))
    return
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(transcriptEntry)
      .values([...asked, ...turn.entries].map((entry) => ({ memberId: member.id, entry })))
    await tx.insert(message).values(agentMessages(member, turn.replies, now))
  })
}

export type CardChoice = "undo" | "accept" | "decline"

// What the agent is told happened to its card, so the next turn knows.
function noteOf(member: Member, card: Card) {
  const about = card.type === "receipt" ? `${card.title}: ${card.detail}` : card.title
  const outcome = {
    undone: "desfez",
    accepted: "confirmou",
    declined: "recusou",
    stale: "tentou aplicar, mas a agenda tinha mudado desde então e nada foi feito em",
    applied: "",
    pending: "",
  }[card.status]
  return `[Aviso do Cuida, não escrito pelo membro] ${member.name} ${outcome} "${about}".`
}

// A member acts on one of the agent's cards in their own conversation.
export async function actOnCard(member: Member, messageId: string, choice: CardChoice) {
  const [found] = await db
    .select({ card: message.card, action: message.action })
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.memberId, member.id)))
  const { card, action } = found ?? {}
  if (!card || !action) return undefined

  let status: Card["status"] | undefined
  if (card.type === "receipt" && card.status === "applied" && choice === "undo" && action.kind === "undo")
    status = (await applyRestores(member, action.restores)) === "restored" ? "undone" : "stale"
  if (card.type === "approval" && card.status === "pending" && action.kind === "cancel") {
    if (choice === "decline") status = "declined"
    if (choice === "accept") {
      const cancelled = await cancelAppointment(
        member,
        action.appointmentId,
        new Date(action.updatedAt),
      )
      status = cancelled === "stale" ? "stale" : "accepted"
    }
  }
  if (!status) return card

  const updated = { ...card, status } as Card
  await db.transaction(async (tx) => {
    await tx.update(message).set({ card: updated }).where(eq(message.id, messageId))
    await tx.insert(transcriptEntry).values({
      memberId: member.id,
      entry: { role: "user", content: noteOf(member, updated) },
    })
  })
  return updated
}
