import { beforeEach, describe, expect, test } from "bun:test"
import { createOrganization, resetDatabase } from "@/test/fixtures"
import type { Member } from "../member"
import { createAgents } from "../organization/agents"
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
  await createAgents(ana, [{ ...lia, tools: ["read_agenda"], actsAlone: [] }])
  const execution = await run("read_organization", {})
  expect(JSON.parse(execution.result.content as string)).toEqual({
    profile: null,
    agents: [{ name: "Lia", role: "Secretária da agenda", tools: ["read_agenda"], acts_alone: [] }],
  })
})

describe("propose_team", () => {
  test("only proposes: a pending card, with every agent able to find customers and read the agenda", async () => {
    const execution = await run("propose_team", { agents: [lia] })
    expect(execution.card).toEqual({
      type: "approval",
      title: "Criar este agente?",
      rows: [
        {
          label: "Lia",
          value: "Secretária da agenda. Faz sozinho: Marcar sessões. Pergunta antes: Remarcar sessões.",
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
        },
      ],
    })
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
