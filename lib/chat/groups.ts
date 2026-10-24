import type Anthropic from "@anthropic-ai/sdk"
import { and, asc, desc, eq, gt, inArray, lte, max, ne, or, sql } from "drizzle-orm"
import { listTeam } from "../agenda/team"
import type { Card } from "../agent/cards"
import { groupLooks } from "../agent/look"
import type { Model } from "../agent/model"
import { turnContext } from "../agent/prompt"
import { type AgentReply, runTurn, unanswered } from "../agent/run-turn"
import { db } from "../db"
import { agent as agentTable, chatGroupAgent, chatGroupMember, groupMessage, groupRead, groupTranscriptEntry } from "../db/schema"
import { type Member, manages, organizationTimeZone } from "../member"
import type { Agent } from "../organization/agents"
import { type Group, listGroups, teamAgents } from "../organization/groups"
import { aboutOf, type CardChoice, type CardSettled, decideCard, harnessFor, noteOf } from "./conversation"
import { mentionsIn } from "./mentions"

// Groups: the team and its agents talking together. An agent answers only when someone calls it
// with @ and its name, acting for whoever called it; only that person acts on the cards it shows.
// Each agent keeps a transcript of its own per group, apart from its direct conversations.

// Names by id of everyone who writes in the organization's groups, including who left the team.
async function authors(organizationId: string) {
  const [team, agents] = await Promise.all([
    listTeam(organizationId),
    db
      .select({ id: agentTable.id, name: agentTable.name, shape: agentTable.shape, color: agentTable.color })
      .from(agentTable)
      .where(eq(agentTable.organizationId, organizationId)),
  ])
  return {
    members: new Map(team.map((teammate) => [teammate.id, teammate.name])),
    agents: new Map(agents.map((agent) => [agent.id, agent])),
  }
}

type Authors = Awaited<ReturnType<typeof authors>>

const someoneWhoLeft = "Alguém que saiu da equipe"
const memberName = (names: Authors, memberId: string | null) =>
  (memberId && names.members.get(memberId)) || someoneWhoLeft

// What the member's browser gets: who wrote each message and, on an agent's card, who acts on it
// when it isn't them. Never a card's action.
export async function listGroupMessages(member: Member, group: Group) {
  const [rows, names] = await Promise.all([
    db
      .select({
        id: groupMessage.id,
        author: groupMessage.author,
        memberId: groupMessage.memberId,
        agentId: groupMessage.agentId,
        text: groupMessage.text,
        card: groupMessage.card,
        createdAt: groupMessage.createdAt,
      })
      .from(groupMessage)
      .where(eq(groupMessage.groupId, group.id))
      .orderBy(asc(groupMessage.createdAt)),
    authors(member.organizationId),
  ])
  return rows.map(({ memberId, agentId, ...row }) => {
    const agent = row.author === "agent" && agentId ? names.agents.get(agentId) : undefined
    return {
      ...row,
      mine: row.author === "member" && memberId === member.id,
      by: agent
        ? { kind: "agent" as const, id: agent.id, name: agent.name, shape: agent.shape, color: agent.color }
        : { kind: "member" as const, name: memberName(names, memberId) },
      // The card is for whoever called the agent; anyone else only sees it.
      cardFor: row.card && memberId !== member.id ? memberName(names, memberId) : null,
    }
  })
}

export type GroupChatMessage = Awaited<ReturnType<typeof listGroupMessages>>[number]

// The member writes in the group. An agent of the group called with @ answers them; one that isn't
// in the group doesn't see it, and the member is told so.
export async function sendGroupMessage(
  member: Member,
  group: Group,
  text: string,
  { model, now = new Date() }: { model: Model; now?: Date },
): Promise<{ notice?: string }> {
  const everyAgent = await db
    .select({ id: agentTable.id, name: agentTable.name })
    .from(agentTable)
    .where(eq(agentTable.organizationId, member.organizationId))
  const called = mentionsIn(text, everyAgent)
  const inGroup = called.flatMap((mention) => group.agents.filter((agent) => agent.id === mention.id))
  // The first agent of the group called answers; calling more at once is for later.
  const answering = inGroup[0]
  const outside = called.filter((mention) => !group.agents.some((agent) => agent.id === mention.id))
  const notice = outside.length
    ? `${outside.map((agent) => agent.name).join(", ")} não ${outside.length > 1 ? "estão" : "está"} neste grupo e não vai ver a mensagem.`
    : undefined

  const [sent] = await db
    .insert(groupMessage)
    .values({ groupId: group.id, author: "member", memberId: member.id, agentId: answering?.id, text, createdAt: now })
    .returning()
  if (answering) await answerInGroup(member, group, answering, { id: sent.id, text, createdAt: now }, { model, now })
  return notice ? { notice } : {}
}

// What the agent reads at most of what the group said since it last answered.
const readAtMost = 40

// Replies are stored a millisecond apart, so they list in the order the agent gave them.
const agentMessages = (member: Member, group: Group, agent: Agent, replies: AgentReply[], after: Date) =>
  replies.map((reply, index) => ({
    groupId: group.id,
    author: "agent" as const,
    memberId: member.id,
    agentId: agent.id,
    createdAt: new Date(after.getTime() + index + 1),
    ...("text" in reply ? { text: reply.text } : { card: reply.card, action: reply.action }),
  }))

// How a message reaches an agent: with who wrote it, and "(para você)" on what it answers now.
function lineOf(
  row: { author: "member" | "agent"; memberId: string | null; agentId: string | null; text: string | null; card: Card | null },
  names: Authors,
  forYou: boolean,
) {
  if (row.author === "agent") {
    const name = names.agents.get(row.agentId ?? "")?.name ?? "Agente"
    return `${name} (agente): ${row.card ? `[card] ${aboutOf(row.card)}` : (row.text ?? "")}`
  }
  return `${memberName(names, row.memberId)}${forYou ? " (para você)" : ""}: ${row.text ?? ""}`
}

// The agent answers one message it was called in. One turn at a time per agent and group, so each
// starts from the transcript the last one left. The agent reads what the group said since its
// last turn, up to that message; if an earlier turn already read it, the message comes again on
// its own.
async function answerInGroup(
  member: Member,
  group: Group,
  agent: Agent,
  called: { id: string; text: string; createdAt: Date },
  { model, now }: { model: Model; now: Date },
) {
  const place = { group: group.name, others: group.agents.filter((other) => other.id !== agent.id).map((other) => other.name) }
  const [names, team, harness] = await Promise.all([
    authors(member.organizationId),
    listTeam(member.organizationId),
    harnessFor(member, agent, now, "asked", place),
  ])

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`group:${group.id}:${agent.id}`}, 0))`)
    const inTranscript = and(eq(groupTranscriptEntry.groupId, group.id), eq(groupTranscriptEntry.agentId, agent.id))
    const [transcript, [{ readUpTo }]] = await Promise.all([
      tx.select({ entry: groupTranscriptEntry.entry }).from(groupTranscriptEntry).where(inTranscript).orderBy(asc(groupTranscriptEntry.seq)),
      tx.select({ readUpTo: max(groupTranscriptEntry.readUpTo) }).from(groupTranscriptEntry).where(inTranscript),
    ])

    let request: string
    if (readUpTo && called.createdAt <= readUpTo) {
      request = `Agora, para você:\n${lineOf({ author: "member", memberId: member.id, agentId: agent.id, text: called.text, card: null }, names, true)}`
    } else {
      const said = await tx
        .select()
        .from(groupMessage)
        .where(
          and(
            eq(groupMessage.groupId, group.id),
            readUpTo ? gt(groupMessage.createdAt, readUpTo) : undefined,
            lte(groupMessage.createdAt, called.createdAt),
            // What the agent wrote is in its transcript already.
            or(eq(groupMessage.author, "member"), ne(groupMessage.agentId, agent.id)),
          ),
        )
        .orderBy(desc(groupMessage.createdAt))
        .limit(readAtMost + 1)
      const lines = said
        .slice(0, readAtMost)
        .reverse()
        .map((row) => lineOf(row, names, row.id === called.id))
      request = [
        "Mensagens no grupo desde a sua última resposta:",
        ...(said.length > readAtMost ? ["(as mais antigas ficaram de fora)"] : []),
        ...lines,
      ].join("\n")
    }
    const asked: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: request },
      {
        role: "system",
        content: turnContext({ speaker: { ...member, manages: manages(member) }, team, now, timeZone: organizationTimeZone }),
      },
    ]

    let turn
    try {
      turn = await runTurn({ model, ...harness, transcript: [...transcript.map((row) => row.entry), ...asked] })
    } catch (failure) {
      // Nothing reaches the transcript, so the next turn reads these messages again.
      console.error("Agent turn failed", failure)
      await tx.insert(groupMessage).values(agentMessages(member, group, agent, [{ text: unanswered }], now))
      return
    }
    const readNow = !readUpTo || called.createdAt > readUpTo ? called.createdAt : null
    await tx.insert(groupTranscriptEntry).values(
      [...asked, ...turn.entries].map((entry, index) => ({
        groupId: group.id,
        agentId: agent.id,
        entry,
        readUpTo: index === 0 ? readNow : null,
      })),
    )
    await tx.insert(groupMessage).values(agentMessages(member, group, agent, turn.replies, now))
  })
}

// Whoever called the agent acts on the card it showed them in the group, and nobody else.
export async function actOnGroupCard(
  member: Member,
  group: Group,
  messageId: string,
  choice: CardChoice,
  settled: CardSettled = {},
) {
  const [found] = await db
    .select({ card: groupMessage.card, action: groupMessage.action, memberId: groupMessage.memberId, agentId: groupMessage.agentId })
    .from(groupMessage)
    .where(and(eq(groupMessage.id, messageId), eq(groupMessage.groupId, group.id), eq(groupMessage.author, "agent")))
  const agent = group.agents.find((candidate) => candidate.id === found?.agentId)
  if (!found?.card || !found.action || found.memberId !== member.id || !agent) return undefined

  const outcome = await decideCard(member, agent, { card: found.card, action: found.action }, choice, settled)
  if (!outcome) return found.card
  const updated = outcome.card
  const now = settled.now ?? new Date()
  await db.transaction(async (tx) => {
    await tx.update(groupMessage).set({ card: updated }).where(eq(groupMessage.id, messageId))
    await tx.insert(groupTranscriptEntry).values({
      groupId: group.id,
      agentId: agent.id,
      entry: { role: "user", content: noteOf(member, updated, outcome.detail) },
    })
    if (outcome.followUps?.length)
      await tx.insert(groupMessage).values(agentMessages(member, group, agent, outcome.followUps, now))
  })
  return updated
}

// The member read the group up to `upTo`; reading never moves back, nor past now.
export async function markGroupRead(member: Member, group: Group, upTo: Date, now = new Date()) {
  const readAt = upTo > now ? now : upTo
  await db
    .insert(groupRead)
    .values({ memberId: member.id, groupId: group.id, readAt })
    .onConflictDoUpdate({
      target: [groupRead.memberId, groupRead.groupId],
      set: { readAt: sql`greatest(${groupRead.readAt}, excluded.read_at)` },
    })
}

// Each of the member's groups as the list beside the conversation shows it: its last message, with
// who wrote it, and whether someone else wrote since the member last read it.
export async function listGroupSummaries(member: Member) {
  const groups = await listGroups(member)
  if (groups.length === 0) return []
  const ids = groups.map((group) => group.id)
  const [lasts, fromOthers, reads, names, team, chosen, people] = await Promise.all([
    db
      .selectDistinctOn([groupMessage.groupId], {
        groupId: groupMessage.groupId,
        author: groupMessage.author,
        memberId: groupMessage.memberId,
        agentId: groupMessage.agentId,
        text: groupMessage.text,
        card: groupMessage.card,
        createdAt: groupMessage.createdAt,
      })
      .from(groupMessage)
      .where(inArray(groupMessage.groupId, ids))
      .orderBy(groupMessage.groupId, desc(groupMessage.createdAt)),
    db
      .select({ groupId: groupMessage.groupId, at: max(groupMessage.createdAt) })
      .from(groupMessage)
      .where(
        and(
          inArray(groupMessage.groupId, ids),
          or(ne(groupMessage.author, "member"), ne(groupMessage.memberId, member.id)),
        ),
      )
      .groupBy(groupMessage.groupId),
    db
      .select({ groupId: groupRead.groupId, readAt: groupRead.readAt })
      .from(groupRead)
      .where(eq(groupRead.memberId, member.id)),
    authors(member.organizationId),
    teamAgents(member.organizationId),
    db
      .select({ groupId: chatGroupAgent.groupId, agentId: chatGroupAgent.agentId })
      .from(chatGroupAgent)
      .where(inArray(chatGroupAgent.groupId, ids)),
    db
      .select({ groupId: chatGroupMember.groupId, memberId: chatGroupMember.memberId })
      .from(chatGroupMember)
      .where(inArray(chatGroupMember.groupId, ids)),
  ])
  const byGroup = <T extends { groupId: string }>(rows: T[]) => new Map(rows.map((row) => [row.groupId, row]))
  // How each group looks in the list: its agents, in the order the team was built, then its people.
  const looksOf = (group: { id: string; general: boolean }) =>
    groupLooks(
      team
        .filter((agent) => group.general || chosen.some((row) => row.groupId === group.id && row.agentId === agent.id))
        .map(({ shape, color }) => ({ shape, color })),
      [...names.members.keys()].filter(
        (id) => group.general || people.some((row) => row.groupId === group.id && row.memberId === id),
      ),
    )
  const [lastOf, othersAt, readAt] = [byGroup(lasts), byGroup(fromOthers), byGroup(reads)]

  return groups.map((group) => {
    const last = lastOf.get(group.id)
    const who = !last
      ? null
      : last.author === "agent"
        ? (names.agents.get(last.agentId ?? "")?.name ?? "Agente")
        : last.memberId === member.id
          ? "Você"
          : memberName(names, last.memberId)
    const said = last ? (last.card ? aboutOf(last.card) : (last.text ?? "")) : group.general ? "Toda a equipe e os agentes" : "Grupo criado"
    const wroteAt = othersAt.get(group.id)?.at
    const read = readAt.get(group.id)?.readAt
    return {
      id: group.id,
      name: group.name,
      looks: looksOf(group),
      preview: `${who ? `${who}: ` : ""}${said.replace(/\s+/g, " ").trim()}`,
      lastAt: last?.createdAt ?? group.createdAt,
      unread: Boolean(wroteAt && (!read || wroteAt > read)),
    }
  })
}
