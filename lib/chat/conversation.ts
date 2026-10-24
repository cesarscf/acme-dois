import type Anthropic from "@anthropic-ai/sdk"
import { and, asc, desc, eq, max, sql } from "drizzle-orm"
import { applyRestores, cancelAppointment, changesOfRestores } from "../agenda/appointments"
import { listTeam } from "../agenda/team"
import { agendaTools } from "../agent/agenda-tools"
import type { AgentChoice, Card, CardAction, TeamCard } from "../agent/cards"
import type { Model } from "../agent/model"
import { type Arrival, type GroupPlace, introText, setupPrompt, teamPrompt, turnContext, welcomeText } from "../agent/prompt"
import { type AgentReply, runTurn, unanswered } from "../agent/run-turn"
import { setupTools } from "../agent/setup-tools"
import { createToolRegistry, type ToolContext } from "../agent/tool-registry"
import { db } from "../db"
import { agent as agentTable, conversationRead, message, transcriptEntry } from "../db/schema"
import { type Member, manages, organizationTimeZone } from "../member"
import type { AgentLook } from "../agent/look"
import {
  type Agent,
  AgentError,
  agentOrder,
  createAgents,
  findSetupAgent,
  listAgents,
  newAgentProblem,
  restoreAgentProfile,
  updateAgentLook,
} from "../organization/agents"
import { deleteNewGroup, restoreGroup } from "../organization/groups"
import { findOrganizationProfile } from "../organization/profile"
import { notifyChanges, type Via } from "./notices"

const setupRegistry = createToolRegistry(setupTools)

// What an agent works with: its prompt, the tools its charter gives it, and the turn's context. What
// its tools change on the agenda, `via` says how, is told to whoever it affects. `place` is the
// group it talks in, if any.
export async function harnessFor(member: Member, agent: Agent, now: Date, via: Via, place?: GroupPlace) {
  if (agent.kind === "setup")
    return {
      system: setupPrompt,
      tools: setupRegistry,
      context: { member, now, timeZone: organizationTimeZone, actsAlone: [], appointmentMinutes: null },
      team: await listTeam(member.organizationId),
    }
  const [profile, team] = await Promise.all([
    findOrganizationProfile(member.organizationId),
    listTeam(member.organizationId),
  ])
  return {
    system: teamPrompt(agent, profile, team, place),
    tools: createToolRegistry(agendaTools.filter((tool) => agent.tools.includes(tool.name))),
    context: {
      member,
      now,
      timeZone: organizationTimeZone,
      actsAlone: agent.actsAlone,
      appointmentMinutes: profile?.appointmentMinutes ?? null,
      changed: (changes) => notifyChanges({ actor: member, agentId: agent.id, via, now }, changes, team),
    } satisfies ToolContext,
    // The team, read once for the prompt and for whoever runs the turn.
    team,
  }
}

const inConversation = (member: Member, agent: Agent) =>
  and(eq(message.memberId, member.id), eq(message.agentId, agent.id))

// The setup agent's welcome: whoever joined later finds the agents already working, or who is
// still building them.
async function welcomeFor(member: Member, arrival: Arrival) {
  if (arrival === "before") return welcomeText(member.name)
  const [agents, team] = await Promise.all([listAgents(member), listTeam(member.organizationId)])
  return welcomeText(member.name, arrival, {
    agents: agents.filter((agent) => agent.kind === "team"),
    managers: team.filter((teammate) => teammate.manages && teammate.id !== member.id).map((teammate) => teammate.name),
  })
}

// What the member's browser gets: never a card's action. Every conversation opens with the agent's
// first message, written by the app from what the agent is and never stored, so each member,
// including those who join later, finds it there.
export async function listMessages(member: Member, agent: Agent) {
  const arrival: Arrival = member.joinedAt > agent.createdAt ? "joined" : "before"
  const [rows, opening] = await Promise.all([
    db
      .select({
        id: message.id,
        author: message.author,
        text: message.text,
        card: message.card,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(inConversation(member, agent))
      .orderBy(asc(message.createdAt)),
    agent.kind === "setup" ? welcomeFor(member, arrival) : introText(agent, member.name, arrival),
  ])
  const first = { id: `first-${agent.id}`, author: "agent" as const, text: opening, card: null, createdAt: agent.createdAt }
  return [first, ...rows]
}

export type ChatMessage = Awaited<ReturnType<typeof listMessages>>[number]

// The first line of the message every conversation opens with, which needs nothing but the agent.
const openingLine = (member: Member, agent: Agent) => {
  const arrival: Arrival = member.joinedAt > agent.createdAt ? "joined" : "before"
  const text = agent.kind === "setup" ? welcomeText(member.name, arrival) : introText(agent, member.name, arrival)
  return text.split("\n")[0]
}

// Each of the member's conversations as the list beside them shows it: the agent, its last message
// and whether the agent wrote since the member last read it. The opening message counts as the
// agent's, written when the agent was created.
export async function listConversations(member: Member) {
  const [agents, lasts, lastFromAgent, reads] = await Promise.all([
    db.select().from(agentTable).where(eq(agentTable.organizationId, member.organizationId)).orderBy(...agentOrder),
    db
      .selectDistinctOn([message.agentId], {
        agentId: message.agentId,
        author: message.author,
        text: message.text,
        card: message.card,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(eq(message.memberId, member.id))
      .orderBy(message.agentId, desc(message.createdAt)),
    db
      .select({ agentId: message.agentId, at: max(message.createdAt) })
      .from(message)
      .where(and(eq(message.memberId, member.id), eq(message.author, "agent")))
      .groupBy(message.agentId),
    db
      .select({ agentId: conversationRead.agentId, readAt: conversationRead.readAt })
      .from(conversationRead)
      .where(eq(conversationRead.memberId, member.id)),
  ])
  const byAgent = <T extends { agentId: string }>(rows: T[]) => new Map(rows.map((row) => [row.agentId, row]))
  const [lastOf, agentWroteAt, readAt] = [byAgent(lasts), byAgent(lastFromAgent), byAgent(reads)]

  return agents.map((agent) => {
    const last = lastOf.get(agent.id)
    const said = last ? (last.card ? aboutOf(last.card) : (last.text ?? "")) : openingLine(member, agent)
    const wroteAt = agentWroteAt.get(agent.id)?.at ?? agent.createdAt
    const read = readAt.get(agent.id)?.readAt
    return {
      id: agent.id,
      kind: agent.kind,
      name: agent.name,
      role: agent.role,
      shape: agent.shape,
      color: agent.color,
      preview: `${last?.author === "member" ? "Você: " : ""}${said.replace(/\s+/g, " ").trim()}`,
      lastAt: last?.createdAt ?? agent.createdAt,
      unread: !read || wroteAt > read,
    }
  })
}

export type Conversation = Awaited<ReturnType<typeof listConversations>>[number]

// The member read the conversation up to `upTo`; reading never moves back, nor past now.
export async function markRead(member: Member, agent: Agent, upTo: Date, now = new Date()) {
  const readAt = upTo > now ? now : upTo
  await db
    .insert(conversationRead)
    .values({ memberId: member.id, agentId: agent.id, readAt })
    .onConflictDoUpdate({
      target: [conversationRead.memberId, conversationRead.agentId],
      set: { readAt: sql`greatest(${conversationRead.readAt}, excluded.read_at)` },
    })
}

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

// The member writes to an agent and the agent answers, using the tools its charter gives it. A
// `note` from the app goes to the agent with the member's words, and the member never sees it.
export async function sendMessage(
  member: Member,
  agent: Agent,
  text: string,
  { model, now = new Date(), note }: { model: Model; now?: Date; note?: string },
) {
  // The transcript doesn't hold the member's message, so it is read while that is stored.
  const [transcript, { team, ...harness }] = await Promise.all([
    transcriptOf(member, agent),
    harnessFor(member, agent, now, "asked"),
    db.insert(message).values({ memberId: member.id, agentId: agent.id, author: "member", text, createdAt: now }),
  ])
  const asked: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: note ? `${text}\n\n${note}` : text },
    // Not cleared at the next user message: a tool result is one too, so the agent would lose the
    // date as soon as it read the agenda. Each turn adds its own; the prompt says to use the latest.
    { role: "system", content: turnContext({ speaker: { ...member, manages: manages(member) }, team, now, timeZone: organizationTimeZone }) },
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

export type CardChoice = "undo" | "accept" | "decline" | "choose"

const outcomes: Partial<Record<Card["status"], string>> = {
  undone: "desfez",
  accepted: "confirmou",
  declined: "recusou",
  stale: "tentou aplicar, mas nada foi feito em",
  chosen: "escolheu",
}

export const aboutOf = (card: Card) =>
  card.type === "receipt"
    ? `${card.title}: ${card.detail}`
    : card.type === "look"
      ? `Aparência de ${card.agentName}`
      : card.type === "invite"
        ? `Convite para ${card.name}`
        : card.title

// What the agent is told happened to its card, so the next turn knows.
export function noteOf(member: Member, card: Card, detail?: string) {
  const about = aboutOf(card)
  return `[Aviso do Acme, não escrito pelo membro] ${member.name} ${outcomes[card.status]} "${about}".${detail ? ` ${detail}` : ""}`
}

// `detail` tells the agent why nothing was done, or what was.
export type Outcome = { card: Card; detail?: string; followUps?: AgentReply[] }

// Applies a confirmed card's action, or says why it couldn't.
async function accept(
  member: Member,
  agent: Agent,
  action: CardAction,
  now: Date,
): Promise<Omit<Outcome, "card"> & { status: Card["status"] } | undefined> {
  if (action.kind === "cancel") {
    const cancelled = await cancelAppointment(member, action.appointmentId, new Date(action.updatedAt))
    if (cancelled === "stale") return { status: "stale", detail: "Motivo: a sessão mudou depois que o agente perguntou." }
    await notifyChanges({ actor: member, agentId: agent.id, via: "confirmed", now }, [{ from: cancelled, to: null }])
    return { status: "accepted" }
  }
  if (action.kind === "apply") {
    const { tools, context } = await harnessFor(member, agent, now, "confirmed")
    const { result, card, action: undo } = await tools.execute(
      { id: "confirmed", name: action.tool, input: action.input },
      { ...context, confirmed: true },
    )
    if (result.is_error) return { status: "stale", detail: `Motivo: ${result.content}` }
    return {
      status: "accepted",
      detail: `Resultado: ${result.content}`,
      followUps: card ? [{ card, action: undo }] : [],
    }
  }
  return undefined
}

// Creates the proposed agents with the names and looks the member settled in the card, or says why
// it couldn't. The card then shows them as they were created.
async function createTeam(
  member: Member,
  card: TeamCard,
  action: Extract<CardAction, { kind: "create_agents" }>,
  choices: AgentChoice[] | undefined,
): Promise<Outcome> {
  const settled = action.agents.map((proposed, index) => ({ ...proposed, ...choices?.[index] }))
  if (settled.some((agent) => !agent.name.trim()))
    return { card: { ...card, status: "stale" }, detail: "Motivo: faltou o nome de um dos agentes." }
  try {
    const created = await createAgents(member, settled)
    return {
      card: {
        ...card,
        agents: card.agents.map((shown, index) => ({ ...shown, ...choices?.[index] })),
        status: "accepted",
      },
      detail: `Agentes criados, com o nome e a aparência que o membro escolheu: ${created
        .map((agent) => `${agent.name} (id ${agent.id}, forma ${agent.shape}, cor ${agent.color})`)
        .join(", ")}.`,
    }
  } catch (failure) {
    if (failure instanceof AgentError) return { card: { ...card, status: "stale" }, detail: `Motivo: ${failure.message}` }
    throw failure
  }
}

export type CardSettled = { now?: Date; look?: AgentLook; team?: AgentChoice[] }

// What a member's choice on one of an agent's cards does, applied; nothing when the card no longer
// takes that choice.
export async function decideCard(
  member: Member,
  agent: Agent,
  { card, action }: { card: Card; action: CardAction },
  choice: CardChoice,
  { now = new Date(), look, team }: CardSettled = {},
): Promise<Outcome | undefined> {
  if (card.type === "receipt" && card.status === "applied" && choice === "undo" && action.kind === "undo") {
    const restored = await applyRestores(member, action.restores)
    if (restored !== "stale")
      await notifyChanges({ actor: member, agentId: agent.id, via: "undone", now }, changesOfRestores(restored))
    return { card: { ...card, status: restored === "stale" ? "stale" : "undone" } }
  }
  if (card.type === "receipt" && card.status === "applied" && choice === "undo") {
    const undone =
      action.kind === "restore_group"
        ? await restoreGroup(member, action.groupId, action)
        : action.kind === "delete_group"
          ? await deleteNewGroup(member, action.groupId)
          : action.kind === "restore_agent"
            ? await restoreAgentProfile(member, action.agentId, action)
            : undefined
    if (undone) return { card: { ...card, status: undone === "stale" ? "stale" : "undone" } }
  }
  if (card.type === "approval" && card.status === "pending") {
    const decided =
      choice === "decline"
        ? { status: "declined" as const }
        : choice === "accept"
          ? await accept(member, agent, action, now)
          : undefined
    if (decided) return { ...decided, card: { ...card, status: decided.status } as Card }
  }
  if (card.type === "team" && card.status === "pending" && action.kind === "create_agents") {
    if (choice === "decline") return { card: { ...card, status: "declined" } }
    if (choice === "accept") return createTeam(member, card, action, team)
  }
  if (card.type === "look" && card.status === "pending" && choice === "choose" && look && action.kind === "look") {
    if (await updateAgentLook(member, action.agentId, look))
      return { card: { ...card, look, status: "chosen" }, detail: `Forma ${look.shape}, cor ${look.color}.` }
  }
  return undefined
}

// A member acts on one of an agent's cards in their own conversation with it.
export async function actOnCard(
  member: Member,
  agent: Agent,
  messageId: string,
  choice: CardChoice,
  settled: CardSettled = {},
) {
  const [found] = await db
    .select({ card: message.card, action: message.action })
    .from(message)
    .where(and(eq(message.id, messageId), inConversation(member, agent)))
  const { card, action } = found ?? {}
  if (!card || !action) return undefined

  const outcome = await decideCard(member, agent, { card, action }, choice, settled)
  if (!outcome) return card

  const updated = outcome.card
  const now = settled.now ?? new Date()
  await db.transaction(async (tx) => {
    await tx.update(message).set({ card: updated }).where(eq(message.id, messageId))
    await tx.insert(transcriptEntry).values({
      memberId: member.id,
      agentId: agent.id,
      entry: { role: "user", content: noteOf(member, updated, outcome.detail) },
    })
    if (outcome.followUps?.length)
      await tx.insert(message).values(agentMessages(member, agent, outcome.followUps, now))
  })
  return updated
}

// Who runs the organization asks for a new agent from the app, with its name and look already
// chosen: the setup agent hears it in their conversation and asks what the agent will do.
export async function askForNewAgent(
  member: Member,
  input: { name: string; look: AgentLook },
  { model, now = new Date() }: { model: Model; now?: Date },
) {
  const name = input.name.trim().replace(/\s+/g, " ")
  const [problem, setup] = await Promise.all([newAgentProblem(member, name), findSetupAgent(member)])
  if (problem) throw new AgentError(problem)
  await sendMessage(member, setup, `Quero criar um agente novo: ${name}.`, {
    model,
    now,
    note: `[Aviso do Acme, não escrito pelo membro] O membro pediu pelo botão Novo agente e já escolheu o nome e a aparência: nome "${name}", look { shape: "${input.look.shape}", color: "${input.look.color}" }. Pergunte o que esse agente vai fazer, se ele ainda não disse, e proponha com propose_team usando exatamente esse nome e esse look.`,
  })
  return setup.id
}
