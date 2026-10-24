import { and, asc, eq, sql } from "drizzle-orm"
import type { ProposedAgent } from "../agent/cards"
import { type AgentLook, setupAgentLook } from "../agent/look"
import { db } from "../db"
import { agent } from "../db/schema"
import type { Member } from "../member"

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
    .orderBy(sql`${agent.kind} = 'setup' desc`, asc(agent.createdAt))
}

export async function findAgent(member: Member, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  const [found] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.organizationId, member.organizationId)))
  return found
}

export class AgentError extends Error {}

// All of them or none, so a proposal never half applies.
export async function createAgents(member: Member, agents: ProposedAgent[]) {
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
      .returning({ id: agent.id, name: agent.name })
  } catch (failure) {
    if ((failure as { cause?: { code?: string } }).cause?.code === "23505")
      throw new AgentError("Já existe um agente com um desses nomes.")
    throw failure
  }
}

export async function updateAgentLook(member: Member, id: string, look: AgentLook) {
  const [updated] = await db
    .update(agent)
    .set(look)
    .where(and(eq(agent.id, id), eq(agent.organizationId, member.organizationId)))
    .returning({ id: agent.id })
  return Boolean(updated)
}
