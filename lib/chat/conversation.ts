import type Anthropic from "@anthropic-ai/sdk"
import { and, asc, eq } from "drizzle-orm"
import { applyRestores, cancelAppointment } from "../agenda/appointments"
import { listTeam } from "../agenda/team"
import { agendaTools } from "../agent/agenda-tools"
import type { Card, CardAction } from "../agent/cards"
import type { Model } from "../agent/model"
import { setupPrompt, teamPrompt, turnContext, welcomeText } from "../agent/prompt"
import { type AgentReply, runTurn, unanswered } from "../agent/run-turn"
import { setupTools } from "../agent/setup-tools"
import { createToolRegistry, type ToolContext } from "../agent/tool-registry"
import { db } from "../db"
import { message, transcriptEntry } from "../db/schema"
import { type Member, organizationTimeZone } from "../member"
import { type Agent, AgentError, createAgents } from "../organization/agents"
import { findOrganizationProfile } from "../organization/profile"

const setupRegistry = createToolRegistry(setupTools)

// What an agent works with: its prompt, the tools its charter gives it, and the turn's context.
async function harnessFor(member: Member, agent: Agent, now: Date) {
  if (agent.kind === "setup")
    return {
      system: setupPrompt,
      tools: setupRegistry,
      context: { member, now, timeZone: organizationTimeZone, actsAlone: [], appointmentMinutes: null },
    }
  const profile = await findOrganizationProfile(member.organizationId)
  return {
    system: teamPrompt(agent, profile),
    tools: createToolRegistry(agendaTools.filter((tool) => agent.tools.includes(tool.name))),
    context: {
      member,
      now,
      timeZone: organizationTimeZone,
      actsAlone: agent.actsAlone,
      appointmentMinutes: profile?.appointmentMinutes ?? null,
    } satisfies ToolContext,
  }
}

const inConversation = (member: Member, agent: Agent) =>
  and(eq(message.memberId, member.id), eq(message.agentId, agent.id))

// What the member's browser gets: never a card's action. The setup agent's conversation opens with
// the app's welcome, which is never stored.
export async function listMessages(member: Member, agent: Agent) {
  const rows = await db
    .select({
      id: message.id,
      author: message.author,
      text: message.text,
      card: message.card,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(inConversation(member, agent))
    .orderBy(asc(message.createdAt))
  if (agent.kind !== "setup") return rows
  const welcome = {
    id: `welcome-${agent.id}`,
    author: "agent" as const,
    text: welcomeText(member.name),
    card: null,
    createdAt: agent.createdAt,
  }
  return [welcome, ...rows]
}

export type ChatMessage = Awaited<ReturnType<typeof listMessages>>[number]

async function transcriptOf(member: Member, agent: Agent) {
  const rows = await db
    .select({ entry: transcriptEntry.entry })
    .from(transcriptEntry)
    .where(and(eq(transcriptEntry.memberId, member.id), eq(transcriptEntry.agentId, agent.id)))
    .orderBy(asc(transcriptEntry.seq))
  return rows.map((row) => row.entry)
}

// Replies are stored a millisecond apart, so they list in the order the agent gave them.
const agentMessages = (member: Member, agent: Agent, replies: AgentReply[], after: Date) =>
  replies.map((reply, index) => ({
    memberId: member.id,
    agentId: agent.id,
    author: "agent" as const,
    createdAt: new Date(after.getTime() + index + 1),
    ...("text" in reply ? { text: reply.text } : { card: reply.card, action: reply.action }),
  }))

// The member writes to an agent and the agent answers, using the tools its charter gives it.
export async function sendMessage(
  member: Member,
  agent: Agent,
  text: string,
  { model, now = new Date() }: { model: Model; now?: Date },
) {
  await db
    .insert(message)
    .values({ memberId: member.id, agentId: agent.id, author: "member", text, createdAt: now })
  const [transcript, team, harness] = await Promise.all([
    transcriptOf(member, agent),
    listTeam(member.organizationId),
    harnessFor(member, agent, now),
  ])
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
    turn = await runTurn({ model, ...harness, transcript: [...transcript, ...asked] })
  } catch (failure) {
    // Nothing reaches the transcript, so the next turn starts from the last complete one.
    console.error("Agent turn failed", failure)
    await db.insert(message).values(agentMessages(member, agent, [{ text: unanswered }], now))
    return
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(transcriptEntry)
      .values([...asked, ...turn.entries].map((entry) => ({ memberId: member.id, agentId: agent.id, entry })))
    await tx.insert(message).values(agentMessages(member, agent, turn.replies, now))
  })
}

export type CardChoice = "undo" | "accept" | "decline"

const outcomes: Partial<Record<Card["status"], string>> = {
  undone: "desfez",
  accepted: "confirmou",
  declined: "recusou",
  stale: "tentou aplicar, mas nada foi feito em",
}

// What the agent is told happened to its card, so the next turn knows.
function noteOf(member: Member, card: Card, detail?: string) {
  const about = card.type === "receipt" ? `${card.title}: ${card.detail}` : card.title
  return `[Aviso do Acme, não escrito pelo membro] ${member.name} ${outcomes[card.status]} "${about}".${detail ? ` ${detail}` : ""}`
}

// `detail` tells the agent why nothing was done, or what was.
type Outcome = { status: Card["status"]; detail?: string; followUp?: AgentReply }

// Applies a confirmed card's action, or says why it couldn't.
async function accept(
  member: Member,
  agent: Agent,
  action: CardAction,
  now: Date,
): Promise<Outcome | undefined> {
  if (action.kind === "cancel") {
    const cancelled = await cancelAppointment(member, action.appointmentId, new Date(action.updatedAt))
    return cancelled === "stale"
      ? { status: "stale", detail: "Motivo: a sessão mudou depois que o agente perguntou." }
      : { status: "accepted" }
  }
  if (action.kind === "create_agents") {
    try {
      await createAgents(member, action.agents)
      return { status: "accepted" }
    } catch (failure) {
      if (failure instanceof AgentError) return { status: "stale", detail: `Motivo: ${failure.message}` }
      throw failure
    }
  }
  if (action.kind === "apply") {
    const { tools, context } = await harnessFor(member, agent, now)
    const { result, card, action: undo } = await tools.execute(
      { id: "confirmed", name: action.tool, input: action.input },
      { ...context, confirmed: true },
    )
    if (result.is_error) return { status: "stale", detail: `Motivo: ${result.content}` }
    return {
      status: "accepted",
      detail: `Resultado: ${result.content}`,
      followUp: card ? { card, action: undo } : undefined,
    }
  }
  return undefined
}

// A member acts on one of an agent's cards in their own conversation with it.
export async function actOnCard(
  member: Member,
  agent: Agent,
  messageId: string,
  choice: CardChoice,
  { now = new Date() }: { now?: Date } = {},
) {
  const [found] = await db
    .select({ card: message.card, action: message.action })
    .from(message)
    .where(and(eq(message.id, messageId), inConversation(member, agent)))
  const { card, action } = found ?? {}
  if (!card || !action) return undefined

  let outcome: Outcome | undefined
  if (card.type === "receipt" && card.status === "applied" && choice === "undo" && action.kind === "undo")
    outcome = { status: (await applyRestores(member, action.restores)) === "restored" ? "undone" : "stale" }
  if (card.type === "approval" && card.status === "pending")
    outcome = choice === "decline" ? { status: "declined" } : choice === "accept" ? await accept(member, agent, action, now) : undefined
  if (!outcome) return card

  const updated = { ...card, status: outcome.status } as Card
  await db.transaction(async (tx) => {
    await tx.update(message).set({ card: updated }).where(eq(message.id, messageId))
    await tx.insert(transcriptEntry).values({
      memberId: member.id,
      agentId: agent.id,
      entry: { role: "user", content: noteOf(member, updated, outcome.detail) },
    })
    if (outcome.followUp) await tx.insert(message).values(agentMessages(member, agent, [outcome.followUp], now))
  })
  return updated
}
