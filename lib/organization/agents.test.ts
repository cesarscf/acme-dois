import { beforeEach, describe, expect, test } from "bun:test"
import { createOrganization, joinOrganization, resetDatabase } from "@/test/fixtures"
import type { ProposedAgent } from "../agent/cards"
import { setupAgentLook } from "../agent/look"
import type { Member } from "../member"
import {
  AgentError,
  createAgents,
  createSetupAgent,
  findAgent,
  listAgents,
  setupAgent,
  updateAgentLook,
  restoreAgentProfile,
  updateAgentProfile,
} from "./agents"

const lia: ProposedAgent = {
  name: "Lia",
  role: "Secretária",
  instructions: "Marca e remarca sessões.",
  tools: ["find_customers", "read_agenda", "create_appointment"],
  actsAlone: ["create_appointment"],
  shape: "square",
  color: "#9b6bff",
}

let ana: Member

beforeEach(async () => {
  await resetDatabase()
  ;[ana] = await createOrganization("Ana")
})

test("every organization has exactly one setup agent", async () => {
  await createSetupAgent(ana.organizationId)
  expect(await listAgents(ana)).toEqual([
    { id: expect.any(String), kind: "setup", name: setupAgent.name, role: setupAgent.role, ...setupAgentLook },
  ])
})

test("lists the setup agent first, then the team in the order it was built", async () => {
  await createAgents(ana, [lia])
  await createAgents(ana, [{ ...lia, name: "Tom" }])
  expect((await listAgents(ana)).map((agent) => agent.name)).toEqual([setupAgent.name, "Lia", "Tom"])
})

test("finds an agent only inside its organization", async () => {
  const [created] = await createAgents(ana, [lia])
  const [other] = await createOrganization("Outra")
  expect((await findAgent(ana, created.id))?.name).toBe("Lia")
  expect(await findAgent(other, created.id)).toBeUndefined()
  expect(await findAgent(ana, "not-a-uuid")).toBeUndefined()
})

describe("createAgents", () => {
  test("refuses a name already taken in the organization, whatever the case", async () => {
    await createAgents(ana, [lia])
    await expect(createAgents(ana, [{ ...lia, name: "LIA" }])).rejects.toBeInstanceOf(AgentError)
  })

  test("creates none when two share a name", async () => {
    await expect(createAgents(ana, [lia, { ...lia, name: "Tom" }, { ...lia, name: "tom" }])).rejects.toThrow(
      "Dois agentes se chamam tom.",
    )
    expect(await listAgents(ana)).toHaveLength(1)
  })

  test("lets another organization use the same name", async () => {
    const [other] = await createOrganization("Outra")
    await createAgents(ana, [lia])
    expect(await createAgents(other, [lia])).toHaveLength(1)
  })
})

test("updateAgentLook changes an agent's look only inside its organization", async () => {
  const [created] = await createAgents(ana, [lia])
  const [other] = await createOrganization("Outra")
  expect(await updateAgentLook(other, created.id, { shape: "blob", color: "#2ea603" })).toBe(false)
  expect(await updateAgentLook(ana, created.id, { shape: "blob", color: "#2ea603" })).toBe(true)
  expect(await findAgent(ana, created.id)).toMatchObject({ shape: "blob", color: "#2ea603" })
})

test("only who runs the organization creates agents or changes their look", async () => {
  const joana = await joinOrganization(ana.organizationId, "Joana")
  await expect(createAgents(joana, [lia])).rejects.toThrow(AgentError)
  const [created] = await createAgents(ana, [lia])
  expect(await updateAgentLook(joana, created.id, { shape: "round", color: "#2f80ff" })).toBe(false)
  expect(await findAgent(ana, created.id)).toMatchObject({ shape: "square", color: "#9b6bff" })
})

describe("updateAgentProfile", () => {
  test("renames a team agent and changes its role, trimmed", async () => {
    const [created] = await createAgents(ana, [lia])
    const change = await updateAgentProfile(ana, created.id, { name: "  Nina  Souza ", role: "Recepção" })
    expect(change).toEqual({ from: { name: "Lia", role: "Secretária" }, to: { name: "Nina Souza", role: "Recepção" } })
    expect(await findAgent(ana, created.id)).toMatchObject({ name: "Nina Souza", role: "Recepção" })
  })

  test("turns down a name in use, an empty one, the setup agent and whoever doesn't run the organization", async () => {
    const [created] = await createAgents(ana, [lia, { ...lia, name: "Tom" }])
    expect(updateAgentProfile(ana, created.id, { name: "tom" })).rejects.toThrow("Já existe um agente chamado tom.")
    expect(updateAgentProfile(ana, created.id, { name: " " })).rejects.toThrow(AgentError)
    const [setup] = await listAgents(ana)
    expect(updateAgentProfile(ana, setup.id, { name: "Bot" })).rejects.toThrow("Esse agente não pode ser mudado.")
    const joana = await joinOrganization(ana.organizationId, "Joana")
    expect(updateAgentProfile(joana, created.id, { role: "Outra" })).rejects.toThrow(AgentError)
    expect(await findAgent(ana, created.id)).toMatchObject({ name: "Lia", role: "Secretária" })
  })
})

describe("restoreAgentProfile", () => {
  test("puts the name and role back while they are as the change left them", async () => {
    const [created] = await createAgents(ana, [lia])
    const change = await updateAgentProfile(ana, created.id, { name: "Nina" })
    expect(await restoreAgentProfile(ana, created.id, change)).toBe("restored")
    expect(await findAgent(ana, created.id)).toMatchObject({ name: "Lia" })
    expect(await restoreAgentProfile(ana, created.id, change)).toBe("stale")
  })
})
