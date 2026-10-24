import { beforeEach, describe, expect, test } from "bun:test"
import { createOrganization, resetDatabase } from "@/test/fixtures"
import type { Member } from "../member"
import { createAgents, setupAgent } from "../organization/agents"
import { findOrganizationProfile } from "../organization/profile"
import { setupTools } from "./setup-tools"
import { createToolRegistry } from "./tool-registry"

const registry = createToolRegistry(setupTools)

let ana: Member

beforeEach(async () => {
  await resetDatabase()
  ;[ana] = await createOrganization("Ana")
})

const run = (name: string, input: unknown, member = ana) =>
  registry.execute(
    { id: "toolu_1", name, input },
    { member, now: new Date(), timeZone: "America/Sao_Paulo", actsAlone: [], appointmentMinutes: null },
  )

const lia = {
  name: "Lia",
  role: "Secretária da agenda",
  instructions: "Você marca e remarca as sessões.",
  tools: ["create_appointment", "reschedule_appointment"],
  acts_alone: ["create_appointment"],
}

test("save_organization_profile replaces the profile and shows it in a receipt without undo", async () => {
  await run("save_organization_profile", { about: "Fisioterapia.", appointment_minutes: 50 })
  const execution = await run("save_organization_profile", { about: "Fisio e pilates.", appointment_minutes: null })
  expect(execution.card).toEqual({
    type: "receipt",
    title: "Anotei como a clínica trabalha",
    detail: "Fisio e pilates.",
    status: "applied",
    undoable: false,
  })
  expect(await findOrganizationProfile(ana.organizationId)).toEqual({ about: "Fisio e pilates.", appointmentMinutes: null })
})

test("read_organization shows the profile and the team, not the setup agent", async () => {
  const [created] = await createAgents(ana, [
    { ...lia, tools: ["read_agenda"], actsAlone: [], shape: "round", color: "#2f80ff" },
  ])
  const execution = await run("read_organization", {})
  expect(JSON.parse(execution.result.content as string)).toEqual({
    profile: null,
    agents: [{ id: created.id, name: "Lia", role: "Secretária da agenda", tools: ["read_agenda"], acts_alone: [] }],
  })
})

describe("propose_team", () => {
  test("only proposes: a pending card, with every agent able to find customers and read the agenda", async () => {
    const execution = await run("propose_team", { agents: [lia] })
    expect(execution.card).toEqual({
      type: "team",
      title: "Criar este agente?",
      agents: [
        {
          name: "Lia",
          role: "Secretária da agenda",
          shape: "square",
          color: "#2f80ff",
          details: [
            { label: "O que faz", value: "Você marca e remarca as sessões." },
            { label: "Sozinho", value: "Marcar sessões" },
            { label: "Pergunta antes", value: "Remarcar sessões" },
          ],
        },
      ],
      status: "pending",
    })
    expect(execution.action).toEqual({
      kind: "create_agents",
      agents: [
        {
          name: "Lia",
          role: "Secretária da agenda",
          instructions: "Você marca e remarca as sessões.",
          tools: ["find_customers", "read_agenda", "create_appointment", "reschedule_appointment"],
          actsAlone: ["create_appointment"],
          shape: "square",
          color: "#2f80ff",
        },
      ],
    })
  })

  test("gives each new agent a look the team isn't using", async () => {
    const execution = await run("propose_team", { agents: [lia, { ...lia, name: "Tom" }] })
    const { agents } = execution.action as { agents: { shape: string; color: string }[] }
    expect(agents.map(({ shape, color }) => [shape, color])).toEqual([
      ["square", "#2f80ff"],
      ["round", "#9b6bff"],
    ])
  })

  test("never lets an agent cancel alone", async () => {
    const execution = await run("propose_team", {
      agents: [{ ...lia, tools: ["cancel_appointment"], acts_alone: ["cancel_appointment"] }],
    })
    expect(execution.result).toMatchObject({ is_error: true, content: "Lia não pode usar cancel_appointment sem perguntar." })
  })

  test("refuses acting alone with a tool the agent doesn't have", async () => {
    const execution = await run("propose_team", { agents: [{ ...lia, acts_alone: ["assign_appointment"] }] })
    expect(execution.result.is_error).toBe(true)
  })

  test("refuses a tool that isn't an agenda tool", async () => {
    const execution = await run("propose_team", { agents: [{ ...lia, tools: ["propose_team"] }] })
    expect(execution.result.content).toStartWith("Entrada inválida para propose_team")
  })

  test("refuses a name the organization already uses", async () => {
    const execution = await run("propose_team", { agents: [{ ...lia, name: "acme bot" }] })
    expect(execution.result).toMatchObject({ is_error: true, content: "Já existe um agente chamado acme bot." })
  })
})

describe("choose_agent_look", () => {
  test("shows a card to pick the agent's look, starting from the one it has", async () => {
    const [created] = await createAgents(ana, [
      { ...lia, actsAlone: [], shape: "blob", color: "#ff5cae" },
    ])
    const execution = await run("choose_agent_look", { agent_id: created.id })
    expect(execution.card).toEqual({
      type: "look",
      agentName: "Lia",
      look: { shape: "blob", color: "#ff5cae" },
      status: "pending",
    })
    expect(execution.action).toEqual({ kind: "look", agentId: created.id })
  })

  test("refuses the setup agent and agents of another organization", async () => {
    const [other] = await createOrganization("Outra")
    const [theirs] = await createAgents(other, [{ ...lia, actsAlone: [], shape: "blob", color: "#ff5cae" }])
    expect((await run("choose_agent_look", { agent_id: theirs.id })).result.is_error).toBe(true)
    const [setup] = await import("../organization/agents").then(({ listAgents }) => listAgents(ana))
    expect(setup.name).toBe(setupAgent.name)
    expect((await run("choose_agent_look", { agent_id: setup.id })).result.is_error).toBe(true)
  })
})
