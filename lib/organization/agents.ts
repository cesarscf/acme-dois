import { and, asc, eq, sql } from "drizzle-orm"
import type { ProposedAgent } from "../agent/cards"
import { type AgentLook, setupAgentLook } from "../agent/look"
import { db } from "../db"
import { agent } from "../db/schema"
import { type Member, manages } from "../member"

export const setupAgent = { name: "Acme Bot", role: "Configura a sua equipe de agentes" }

export type Agent = typeof agent.$inferSelect

// Every organization starts with its setup agent; calling this again changes nothing.
export async function createSetupAgent(organizationId: string) {
  await db
    .insert(agent)
    .values({
      organizationId,
      kind: "setup",
      ...setupAgent,
      ...setupAgentLook,
      instructions: "",
      tools: [],
      actsAlone: [],
    })
    .onConflictDoNothing()
}

// The setup agent first, then the team in the order it was built.
export const agentOrder = [sql`${agent.kind} = 'setup' desc`, asc(agent.createdAt)]

export async function listAgents(member: Member) {
  return db
    .select({
      id: agent.id,
      kind: agent.kind,
      name: agent.name,
      role: agent.role,
      shape: agent.shape,
      color: agent.color,
    })
    .from(agent)
    .where(eq(agent.organizationId, member.organizationId))
    .orderBy(...agentOrder)
}

export async function findAgent(member: Member, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  const [found] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.organizationId, member.organizationId)))
  return found
}

// Every organization has one, made with it.
export async function findSetupAgent(member: Member) {
  const [found] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.organizationId, member.organizationId), eq(agent.kind, "setup")))
  return found
}

export class AgentError extends Error {}

// Why an agent can't be asked for under this name, if it can't.
export async function newAgentProblem(member: Member, name: string) {
  if (!manages(member)) return "Só quem administra a clínica cria agentes."
  if (!name) return "Dê um nome ao agente."
  if (name.length > 40) return "O nome do agente pode ter até 40 letras."
  const [taken] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.organizationId, member.organizationId), sql`lower(${agent.name}) = lower(${name})`))
  return taken ? `Já existe um agente chamado ${name}.` : undefined
}

// All of them or none, so a proposal never half applies.
export async function createAgents(member: Member, agents: ProposedAgent[]) {
  if (!manages(member)) throw new AgentError("Só quem administra a clínica cria agentes.")
  const names = new Set<string>()
  for (const proposed of agents) {
    const key = proposed.name.toLowerCase()
    if (names.has(key)) throw new AgentError(`Dois agentes se chamam ${proposed.name}.`)
    names.add(key)
  }
  try {
    return await db
      .insert(agent)
      .values(agents.map((proposed) => ({ organizationId: member.organizationId, kind: "team" as const, ...proposed })))
      .returning({ id: agent.id, name: agent.name, shape: agent.shape, color: agent.color })
  } catch (failure) {
    if ((failure as { cause?: { code?: string } }).cause?.code === "23505")
      throw new AgentError("Já existe um agente com um desses nomes.")
    throw failure
  }
}

// Only who runs the organization changes how an agent looks; for anyone else, nothing changes.
export async function updateAgentLook(member: Member, id: string, look: AgentLook) {
  if (!manages(member)) return false
  const [updated] = await db
    .update(agent)
    .set(look)
    .where(and(eq(agent.id, id), eq(agent.organizationId, member.organizationId)))
    .returning({ id: agent.id })
  return Boolean(updated)
}

export type AgentProfileState = { name: string; role: string }

const nameTaken = (failure: unknown, name: string) =>
  (failure as { cause?: { code?: string } }).cause?.code === "23505"
    ? new AgentError(`Já existe um agente chamado ${name}.`)
    : failure

// Who runs the organization renames a team agent or changes its role, and hears how it was and
// how it is now, so the change can be undone. The setup agent keeps its own: the app names it in
// what it writes.
export async function updateAgentProfile(member: Member, id: string, change: { name?: string; role?: string }) {
  if (!manages(member)) throw new AgentError("Só quem administra a clínica muda um agente.")
  const name = change.name?.trim().replace(/\s+/g, " ")
  const role = change.role?.trim().replace(/\s+/g, " ")
  if (name !== undefined && (!name || name.length > 40)) throw new AgentError("O nome do agente tem de 1 a 40 letras.")
  if (role !== undefined && (!role || role.length > 80)) throw new AgentError("O cargo do agente tem de 1 a 80 letras.")
  const found = await findAgent(member, id)
  if (!found || found.kind !== "team") throw new AgentError("Esse agente não pode ser mudado.")
  const from: AgentProfileState = { name: found.name, role: found.role }
  const to: AgentProfileState = { name: name ?? from.name, role: role ?? from.role }
  try {
    await db.update(agent).set(to).where(eq(agent.id, id))
  } catch (failure) {
    throw nameTaken(failure, to.name)
  }
  return { from, to }
}

// Puts an agent's name and role back, while they are still as the change left them.
export async function restoreAgentProfile(
  member: Member,
  id: string,
  { from, to }: { from: AgentProfileState; to: AgentProfileState },
) {
  const found = await findAgent(member, id)
  if (!manages(member) || !found || found.name !== to.name || found.role !== to.role) return "stale"
  try {
    await db.update(agent).set(from).where(eq(agent.id, id))
  } catch (failure) {
    if (nameTaken(failure, from.name) instanceof AgentError) return "stale"
    throw failure
  }
  return "restored"
}
