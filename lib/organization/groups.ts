import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm"
import { listTeam } from "../agenda/team"
import { db } from "../db"
import { agent as agentTable, chatGroup, chatGroupAgent, chatGroupMember, groupMessage, member as memberTable } from "../db/schema"
import { type Member, manages } from "../member"
import { groupLooks } from "../agent/look"
import { type Agent, agentOrder } from "./agents"

// Groups: who is in each one. The general group has the whole team and every team agent; any
// other has the people and agents chosen. What is said in them lives in lib/chat/groups.ts.

export const generalGroupName = "geral"

// Every organization has its general group; calling this again changes nothing.
export async function createGeneralGroup(organizationId: string) {
  await db.insert(chatGroup).values({ organizationId, name: generalGroupName, general: true }).onConflictDoNothing()
}

// The general group, and the groups the member was put in.
const visibleTo = (member: Member) =>
  and(
    eq(chatGroup.organizationId, member.organizationId),
    or(
      eq(chatGroup.general, true),
      sql`exists (select 1 from ${chatGroupMember} where ${chatGroupMember.groupId} = ${chatGroup.id} and ${chatGroupMember.memberId} = ${member.id})`,
    ),
  )

const groupOrder = [desc(chatGroup.general), asc(chatGroup.createdAt)]

// The groups the member is in that have this agent: the general group has every team agent. Each
// with how it looks, its agents then its people, all read at once.
export async function listAgentGroups(member: Member, agent: Pick<Agent, "id" | "kind">) {
  if (agent.kind !== "team") return []
  const inOrganization = sql`${chatGroup.organizationId} = ${member.organizationId}`
  const [groups, agentRows, memberRows, agents, team] = await Promise.all([
    db
      .select({ id: chatGroup.id, name: chatGroup.name, general: chatGroup.general })
      .from(chatGroup)
      .where(
        and(
          visibleTo(member),
          or(
            eq(chatGroup.general, true),
            sql`exists (select 1 from ${chatGroupAgent} where ${chatGroupAgent.groupId} = ${chatGroup.id} and ${chatGroupAgent.agentId} = ${agent.id})`,
          ),
        ),
      )
      .orderBy(...groupOrder),
    db
      .select({ groupId: chatGroupAgent.groupId, agentId: chatGroupAgent.agentId })
      .from(chatGroupAgent)
      .innerJoin(chatGroup, eq(chatGroup.id, chatGroupAgent.groupId))
      .where(inOrganization),
    db
      .select({ groupId: chatGroupMember.groupId, memberId: chatGroupMember.memberId })
      .from(chatGroupMember)
      .innerJoin(chatGroup, eq(chatGroup.id, chatGroupMember.groupId))
      .where(inOrganization),
    teamAgents(member.organizationId),
    listTeam(member.organizationId),
  ])
  return groups.map((group) => ({
    ...group,
    looks: groupLooks(
      agents
        .filter((candidate) => group.general || agentRows.some((row) => row.groupId === group.id && row.agentId === candidate.id))
        .map(({ shape, color }) => ({ shape, color })),
      team
        .filter((teammate) => group.general || memberRows.some((row) => row.groupId === group.id && row.memberId === teammate.id))
        .map(({ id }) => id),
    ),
  }))
}

export async function listGroups(member: Member) {
  return db
    .select({ id: chatGroup.id, name: chatGroup.name, general: chatGroup.general, createdAt: chatGroup.createdAt })
    .from(chatGroup)
    .where(visibleTo(member))
    .orderBy(...groupOrder)
}

export const teamAgents = (organizationId: string) =>
  db
    .select()
    .from(agentTable)
    .where(and(eq(agentTable.organizationId, organizationId), eq(agentTable.kind, "team")))
    .orderBy(...agentOrder)

// A group of the organization, with who is in it: in the general group, the whole team and every
// team agent, as they are now. Only one the member is in, unless `anyInOrganization`.
async function loadGroup(member: Member, id: string, { anyInOrganization = false } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  const [found] = await db
    .select({
      id: chatGroup.id,
      name: chatGroup.name,
      general: chatGroup.general,
      createdBy: chatGroup.createdBy,
      createdAt: chatGroup.createdAt,
    })
    .from(chatGroup)
    .where(
      and(
        eq(chatGroup.id, id),
        anyInOrganization ? eq(chatGroup.organizationId, member.organizationId) : visibleTo(member),
      ),
    )
  if (!found) return undefined
  const [team, agents] = await Promise.all([listTeam(member.organizationId), teamAgents(member.organizationId)])
  if (found.general) return { ...found, members: team, agents }
  const [memberIds, agentIds] = await Promise.all([
    db.select({ id: chatGroupMember.memberId }).from(chatGroupMember).where(eq(chatGroupMember.groupId, id)),
    db.select({ id: chatGroupAgent.agentId }).from(chatGroupAgent).where(eq(chatGroupAgent.groupId, id)),
  ])
  const [inMembers, inAgents] = [new Set(memberIds.map((row) => row.id)), new Set(agentIds.map((row) => row.id))]
  return {
    ...found,
    members: team.filter((teammate) => inMembers.has(teammate.id)),
    agents: agents.filter((candidate) => inAgents.has(candidate.id)),
  }
}

// A group the member is in.
export const findGroup = (member: Member, id: string) => loadGroup(member, id)

export type Group = NonNullable<Awaited<ReturnType<typeof findGroup>>>

export class GroupError extends Error {}

// "# Recepção " is "Recepção".
function groupName(input: string) {
  const name = input.trim().replace(/^#+\s*/, "").replace(/\s+/g, " ")
  if (!name) throw new GroupError("Dê um nome ao grupo.")
  if (name.length > 40) throw new GroupError("O nome do grupo pode ter até 40 letras.")
  return name
}

// People of the team and its agenda agents only: the setup agent talks to each member alone.
async function checkChosen(member: Member, memberIds: string[], agentIds: string[]) {
  const [members, agents] = await Promise.all([
    memberIds.length
      ? db
          .select({ id: memberTable.id })
          .from(memberTable)
          .where(and(eq(memberTable.organizationId, member.organizationId), inArray(memberTable.id, memberIds)))
      : [],
    agentIds.length
      ? db
          .select({ id: agentTable.id })
          .from(agentTable)
          .where(
            and(
              eq(agentTable.organizationId, member.organizationId),
              eq(agentTable.kind, "team"),
              inArray(agentTable.id, agentIds),
            ),
          )
      : [],
  ])
  if (members.length !== memberIds.length) throw new GroupError("Só pessoas da equipe entram no grupo.")
  if (agents.length !== agentIds.length) throw new GroupError("Só agentes de agenda da clínica entram no grupo.")
}

const nameTaken = (failure: unknown, name: string) => {
  if ((failure as { cause?: { code?: string } }).cause?.code === "23505")
    return new GroupError(`Já existe um grupo chamado ${name}.`)
  return failure
}

// Whoever creates a group is always in it.
export async function createGroup(
  member: Member,
  input: { name: string; memberIds: string[]; agentIds: string[] },
) {
  const name = groupName(input.name)
  const memberIds = [...new Set([member.id, ...input.memberIds])]
  const agentIds = [...new Set(input.agentIds)]
  await checkChosen(member, memberIds, agentIds)
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(chatGroup)
        .values({ organizationId: member.organizationId, name, createdBy: member.id })
        .returning({ id: chatGroup.id, name: chatGroup.name })
      await tx.insert(chatGroupMember).values(memberIds.map((memberId) => ({ groupId: created.id, memberId })))
      if (agentIds.length)
        await tx.insert(chatGroupAgent).values(agentIds.map((agentId) => ({ groupId: created.id, agentId })))
      return created
    })
  } catch (failure) {
    throw nameTaken(failure, name)
  }
}

// Who created a group, or runs the organization, changes it: its name and who is in it. The
// general group stays as it is, with everyone.
export const mayManage = (member: Member, group: Pick<Group, "general" | "createdBy">) =>
  !group.general && (group.createdBy === member.id || manages(member))

// A group as a change sees it: its name and who is in it.
export type GroupState = { name: string; memberIds: string[]; agentIds: string[] }

const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort()

const stateOf = (group: Group): GroupState => ({
  name: group.name,
  memberIds: sorted(group.members.map((teammate) => teammate.id)),
  agentIds: sorted(group.agents.map((agent) => agent.id)),
})

const sameState = (a: GroupState, b: GroupState) =>
  a.name === b.name && a.memberIds.join() === b.memberIds.join() && a.agentIds.join() === b.agentIds.join()

async function writeState(groupId: string, state: GroupState) {
  try {
    await db.transaction(async (tx) => {
      await tx.update(chatGroup).set({ name: state.name }).where(eq(chatGroup.id, groupId))
      await tx.delete(chatGroupMember).where(eq(chatGroupMember.groupId, groupId))
      await tx.insert(chatGroupMember).values(state.memberIds.map((memberId) => ({ groupId, memberId })))
      await tx.delete(chatGroupAgent).where(eq(chatGroupAgent.groupId, groupId))
      if (state.agentIds.length)
        await tx.insert(chatGroupAgent).values(state.agentIds.map((agentId) => ({ groupId, agentId })))
    })
  } catch (failure) {
    throw nameTaken(failure, state.name)
  }
}

export type GroupChange = {
  name?: string
  addMemberIds?: string[]
  removeMemberIds?: string[]
  addAgentIds?: string[]
  removeAgentIds?: string[]
}

// Renames the group or changes who is in it, and says how it was and how it is now, so the change
// can be undone.
export async function changeGroup(member: Member, group: Group, change: GroupChange) {
  if (!mayManage(member, group))
    throw new GroupError(
      group.general
        ? "O geral tem sempre toda a equipe e todos os agentes, com esse nome."
        : "Só quem criou o grupo ou administra a clínica muda o grupo.",
    )
  const from = stateOf(group)
  const without = (ids: string[], removed: string[] = []) => ids.filter((id) => !removed.includes(id))
  const to: GroupState = {
    name: change.name === undefined ? from.name : groupName(change.name),
    memberIds: sorted(without([...from.memberIds, ...(change.addMemberIds ?? [])], change.removeMemberIds)),
    agentIds: sorted(without([...from.agentIds, ...(change.addAgentIds ?? [])], change.removeAgentIds)),
  }
  if (to.memberIds.length === 0) throw new GroupError("O grupo precisa de pelo menos uma pessoa.")
  await checkChosen(
    member,
    to.memberIds.filter((id) => !from.memberIds.includes(id)),
    to.agentIds.filter((id) => !from.agentIds.includes(id)),
  )
  if (!sameState(from, to)) await writeState(group.id, to)
  return { from, to }
}

export async function renameGroup(member: Member, group: Group, name: string) {
  return (await changeGroup(member, group, { name })).to.name
}

// Puts a group back as it was before a change, while it is still as the change left it. Whoever
// made the change may have left the group with it.
export async function restoreGroup(member: Member, groupId: string, { from, to }: { from: GroupState; to: GroupState }) {
  const group = await loadGroup(member, groupId, { anyInOrganization: true })
  if (!group || !mayManage(member, group) || !sameState(stateOf(group), to)) return "stale"
  try {
    await writeState(group.id, from)
  } catch (failure) {
    if (failure instanceof GroupError) return "stale"
    throw failure
  }
  return "restored"
}

// Undoes creating a group, while nobody has written in it yet.
export async function deleteNewGroup(member: Member, groupId: string) {
  const group = await loadGroup(member, groupId, { anyInOrganization: true })
  if (!group || !mayManage(member, group)) return "stale"
  const [said] = await db.select({ id: groupMessage.id }).from(groupMessage).where(eq(groupMessage.groupId, groupId)).limit(1)
  if (said) return "stale"
  await db.delete(chatGroup).where(eq(chatGroup.id, groupId))
  return "deleted"
}
