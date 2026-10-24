import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { createOrganization, joinOrganization, resetDatabase } from "@/test/fixtures"
import { scriptedModel, says, uses } from "@/test/scripted-model"
import { createAppointment, findAppointment } from "../agenda/appointments"
import { createCustomer } from "../agenda/customers"
import { personLook } from "../agent/look"
import type { Model } from "../agent/model"
import { teamPrompt } from "../agent/prompt"
import { unanswered } from "../agent/run-turn"
import type { Member } from "../member"
import { type Agent, createAgents, findAgent } from "../organization/agents"
import { listMessages, sendMessage } from "./conversation"
import { actOnGroupCard, listGroupMessages, listGroupSummaries, markGroupRead, sendGroupMessage } from "./groups"
import { createGroup, findGroup, type Group, listAgentGroups, GroupError, listGroups, renameGroup } from "../organization/groups"

// Friday 2026-10-23, 09:00 in São Paulo.
const now = new Date("2026-10-23T12:00:00Z")
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000)

let ana: Member
let bia: Member
let carla: { id: string; name: string }
let lia: Agent
let otto: Agent

beforeEach(async () => {
  await resetDatabase()
  ;[ana, bia] = await createOrganization("Ana", "Bia")
  carla = await createCustomer(ana, { name: "Carla" })
  const charter = {
    role: "Secretária da agenda",
    instructions: "Você marca as sessões que a equipe pedir.",
    tools: ["find_customers", "read_agenda", "create_appointment", "cancel_appointment"],
    actsAlone: ["create_appointment"],
    shape: "round" as const,
    color: "#2f80ff",
  }
  const created = await createAgents(ana, [
    { name: "Lia", ...charter },
    { name: "Otto", ...charter, role: "Confirma as sessões" },
  ])
  ;[lia, otto] = await Promise.all(created.map(async (agent) => (await findAgent(ana, agent.id))!))
})

const general = async (member: Member) => (await findGroup(member, (await listGroups(member))[0].id))!

const shown = async (member: Member, group: Group) =>
  (await listGroupMessages(member, group)).map(({ by, text, card, mine, cardFor }) => ({
    by: by.name,
    text,
    card: card?.status ?? null,
    ...(mine && { mine }),
    ...(cardFor && { cardFor }),
  }))

// A model that fails the test if an agent is asked to answer.
const silent: Model = async () => {
  throw new Error("No agent should answer.")
}

describe("the general group", () => {
  test("is there from the start, with the whole team and every team agent", async () => {
    const group = await general(ana)
    expect(group).toMatchObject({ name: "geral", general: true })
    expect(group.members.map((member) => member.name)).toEqual(["Ana", "Bia"])
    expect(group.agents.map((agent) => agent.name)).toEqual(["Lia", "Otto"])
  })

  test("takes in whoever joins later", async () => {
    const joana = await joinOrganization(ana.organizationId, "Joana")
    expect((await general(joana)).members.map((member) => member.name)).toContain("Joana")
  })
})

describe("createGroup", () => {
  test("has who was chosen and who created it, and only they see it", async () => {
    await joinOrganization(ana.organizationId, "Joana")
    const created = await createGroup(ana, { name: "# Recepção ", memberIds: [bia.id], agentIds: [lia.id] })
    const group = (await findGroup(bia, created.id))!
    expect(group).toMatchObject({ name: "Recepção", general: false })
    expect(group.members.map((member) => member.name)).toEqual(["Ana", "Bia"])
    expect(group.agents.map((agent) => agent.name)).toEqual(["Lia"])

    const joana = await joinOrganization(ana.organizationId, "Caio")
    expect(await findGroup(joana, created.id)).toBeUndefined()
    expect((await listGroups(joana)).map((row) => row.name)).toEqual(["geral"])
  })

  test("turns down a name in use, and anyone or anything outside the team", async () => {
    await createGroup(ana, { name: "Recepção", memberIds: [], agentIds: [] })
    expect(createGroup(bia, { name: "recepção", memberIds: [], agentIds: [] })).rejects.toThrow(GroupError)
    expect(createGroup(bia, { name: "Geral", memberIds: [], agentIds: [] })).rejects.toThrow("Já existe um grupo chamado Geral.")
    expect(createGroup(ana, { name: "Outro", memberIds: [crypto.randomUUID()], agentIds: [] })).rejects.toThrow(GroupError)

    const [other] = await createOrganization("Zé")
    const outsider = await createAgents(other, [
      { name: "Zuri", role: lia.role, instructions: lia.instructions, tools: lia.tools, actsAlone: [], shape: "round", color: "#2f80ff" },
    ])
    expect(createGroup(ana, { name: "Outro", memberIds: [], agentIds: [outsider[0].id] })).rejects.toThrow(GroupError)
  })
})

describe("renameGroup", () => {
  test("whoever created it, or runs the organization, renames it; the general group keeps its name", async () => {
    const joana = await joinOrganization(ana.organizationId, "Joana")
    const created = await createGroup(joana, { name: "Recepção", memberIds: [ana.id, bia.id], agentIds: [] })
    const group = (await findGroup(joana, created.id))!
    expect(await renameGroup(joana, group, "# Recepção da manhã")).toBe("Recepção da manhã")
    expect(await renameGroup(ana, group, "Manhã")).toBe("Manhã")

    const caio = await joinOrganization(ana.organizationId, "Caio")
    await createGroup(joana, { name: "Tarde", memberIds: [caio.id], agentIds: [] })
    const tarde = (await findGroup(caio, (await listGroups(caio))[1].id))!
    expect(renameGroup(caio, { ...tarde }, "Minha")).rejects.toThrow(GroupError)
    expect(renameGroup(joana, (await findGroup(joana, created.id))!, "tarde")).rejects.toThrow("Já existe um grupo chamado tarde.")
    expect(renameGroup(ana, await general(ana), "todos")).rejects.toThrow("O geral tem sempre toda a equipe e todos os agentes, com esse nome.")
  })
})

describe("listAgentGroups", () => {
  test("lists the member's groups the agent is in, the general group first", async () => {
    await createGroup(ana, { name: "Recepção", memberIds: [], agentIds: [otto.id] })
    await createGroup(bia, { name: "Só da Bia", memberIds: [], agentIds: [otto.id] })
    expect((await listAgentGroups(ana, otto)).map((group) => group.name)).toEqual(["geral", "Recepção"])
    expect((await listAgentGroups(ana, lia)).map((group) => group.name)).toEqual(["geral"])
  })
})

describe("writing in a group", () => {
  test("without an @, no agent answers", async () => {
    const group = await general(ana)
    expect(await sendGroupMessage(ana, group, "Bom dia, gente", { model: silent, now })).toEqual({})
    expect(await shown(bia, group)).toEqual([{ by: "Ana", text: "Bom dia, gente", card: null }])
    expect(await shown(ana, group)).toEqual([{ by: "Ana", text: "Bom dia, gente", card: null, mine: true }])
  })

  test("the agent called answers, having read what the group said, from its group prompt", async () => {
    const group = await general(ana)
    await sendGroupMessage(bia, group, "A Carla ligou", { model: silent, now })
    const { model, requests } = scriptedModel(says("Vou ver."))
    await sendGroupMessage(ana, group, "@Lia marca a Carla amanhã?", { model, now: later(1) })

    expect(requests[0].system).toBe(teamPrompt(lia, undefined, [], { group: "geral", others: ["Otto"] }))
    expect(requests[0].system).toContain("Esta conversa é o grupo #geral")
    expect(requests[0].messages[0]).toEqual({
      role: "user",
      content: "Mensagens no grupo desde a sua última resposta:\nBia: A Carla ligou\nAna (para você): @Lia marca a Carla amanhã?",
    })
    expect(requests[0].messages[1].content).toContain("Quem fala com você: Ana")
    expect((await shown(bia, group)).at(-1)).toEqual({ by: "Lia", text: "Vou ver.", card: null })
  })

  test("the agent reads only what was said since it last answered, without its own words", async () => {
    const group = await general(ana)
    const { model, requests } = scriptedModel(says("Oi!"), says("Vi."))
    await sendGroupMessage(ana, group, "@Lia oi", { model, now })
    await sendGroupMessage(bia, group, "@Otto e você?", { model: scriptedModel(says("Tudo certo.")).model, now: later(1) })
    await sendGroupMessage(bia, group, "@Lia viu?", { model, now: later(2) })

    expect(requests[1].messages.slice(0, 2)).toMatchObject([
      { role: "user", content: "Mensagens no grupo desde a sua última resposta:\nAna (para você): @Lia oi" },
      { role: "system" },
    ])
    expect(requests[1].messages[2]).toMatchObject({ role: "assistant" })
    expect(requests[1].messages[3]).toEqual({
      role: "user",
      content: "Mensagens no grupo desde a sua última resposta:\nBia: @Otto e você?\nOtto (agente): Tudo certo.\nBia (para você): @Lia viu?",
    })
  })

  test("a message an earlier turn already read still gets its own answer", async () => {
    const group = await general(ana)
    const { model, requests } = scriptedModel(says("Oi, Ana."), says("Oi, Bia."))
    // Bia wrote first, but Ana's turn got to the agent first and read the group past Bia's message.
    await sendGroupMessage(ana, group, "@Lia e eu", { model, now: later(2) })
    await sendGroupMessage(bia, group, "@Lia sou eu primeiro", { model, now: later(1) })
    expect(requests[1].messages.at(-2)?.content).toBe("Agora, para você:\nBia (para você): @Lia sou eu primeiro")
  })

  test("calls at the same time are answered one turn after the other", async () => {
    const group = await general(ana)
    const { model, requests } = scriptedModel(says("Um."), says("Dois."))
    const slow: Model = async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return model(request)
    }
    await Promise.all([
      sendGroupMessage(ana, group, "@Lia um", { model: slow, now }),
      sendGroupMessage(bia, group, "@Lia dois", { model: slow, now: later(1) }),
    ])
    // The second turn starts from the transcript the first one left.
    expect(requests[1].messages.length).toBeGreaterThan(requests[0].messages.length)
    expect((await shown(ana, group)).filter((row) => row.by === "Lia").map((row) => row.text).sort()).toEqual(["Dois.", "Um."])
  })

  test("calling an agent outside the group says so, and nobody answers", async () => {
    const created = await createGroup(ana, { name: "Recepção", memberIds: [bia.id], agentIds: [lia.id] })
    const group = (await findGroup(ana, created.id))!
    expect(await sendGroupMessage(ana, group, "@Otto você pode?", { model: silent, now })).toEqual({
      notice: `${otto.name} não está neste grupo e não vai ver a mensagem.`,
    })
    expect(await sendGroupMessage(ana, group, "@Acme Bot ajuda?", { model: silent, now })).toEqual({
      notice: "Acme Bot não está neste grupo e não vai ver a mensagem.",
    })
  })

  test("only the first agent of the group called answers", async () => {
    const group = await general(ana)
    const { model } = scriptedModel(says("Eu cuido."))
    await sendGroupMessage(ana, group, "@Otto ou @Lia, quem vê?", { model, now })
    expect((await shown(ana, group)).at(-1)).toMatchObject({ by: "Otto", text: "Eu cuido." })
  })

  test("the group stays apart from each member's direct conversation with the agent", async () => {
    const group = await general(ana)
    await sendMessage(ana, lia, "Segredo: estou cansada", { model: scriptedModel(says("Entendo.")).model, now })
    const { model, requests } = scriptedModel(says("Oi, grupo."))
    await sendGroupMessage(ana, group, "@Lia oi", { model, now: later(1) })
    expect(JSON.stringify(requests[0].messages)).not.toContain("Segredo")

    const direct = scriptedModel(says("Oi."))
    await sendMessage(ana, lia, "E aí?", { model: direct.model, now: later(2) })
    expect(JSON.stringify(direct.requests[0].messages)).not.toContain("Oi, grupo.")
    expect((await listMessages(ana, lia)).map((row) => row.text)).not.toContain("Oi, grupo.")
  })

  test("when the model fails, the agent says so and reads the messages again next time", async () => {
    const group = await general(ana)
    spyOn(console, "error").mockImplementation(() => {})
    await sendGroupMessage(ana, group, "@Lia oi", { model: silent, now })
    expect((await shown(ana, group)).at(-1)).toMatchObject({ by: "Lia", text: unanswered })

    const { model, requests } = scriptedModel(says("Agora sim."))
    await sendGroupMessage(ana, group, "@Lia e agora?", { model, now: later(1) })
    expect(requests[0].messages[0].content).toBe(
      "Mensagens no grupo desde a sua última resposta:\nAna: @Lia oi\nAna (para você): @Lia e agora?",
    )
  })
})

describe("cards in a group", () => {
  async function askToCancel(group: Group) {
    const original = await createAppointment(ana, { customerId: carla.id, memberId: ana.id, startsAt: new Date("2026-10-23T17:00:00Z") })
    const { model } = scriptedModel(
      uses({ name: "cancel_appointment", input: { appointment_id: original.id, reason: null } }),
      says("Confirma?"),
    )
    await sendGroupMessage(ana, group, "@Lia cancela a Carla", { model, now })
    const card = (await listGroupMessages(ana, group)).find((row) => row.card)!
    return { original, card }
  }

  test("everyone sees the card; only who called the agent acts on it", async () => {
    const group = await general(ana)
    const { original, card } = await askToCancel(group)
    expect((await shown(bia, group)).find((row) => row.card)).toMatchObject({ by: "Lia", card: "pending", cardFor: "Ana" })
    expect((await shown(ana, group)).find((row) => row.card)).not.toHaveProperty("cardFor")

    expect(await actOnGroupCard(bia, group, card.id, "accept", { now })).toBeUndefined()
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")

    expect(await actOnGroupCard(ana, group, card.id, "accept", { now })).toMatchObject({ status: "accepted" })
    expect((await findAppointment(ana, original.id))?.status).toBe("cancelled")
  })

  test("the agent hears what was decided, in its group transcript", async () => {
    const group = await general(ana)
    const { card } = await askToCancel(group)
    await actOnGroupCard(ana, group, card.id, "decline", { now })
    const { model, requests } = scriptedModel(says("Ok."))
    await sendGroupMessage(ana, group, "@Lia obrigada", { model, now: later(1) })
    expect(requests[0].messages.at(-3)).toEqual({
      role: "user",
      content: '[Aviso do Acme, não escrito pelo membro] Ana recusou "Cancelar a sessão?".',
    })
  })

  test("never sends a card's action to the browser", async () => {
    const { card } = await askToCancel(await general(ana))
    expect(card).not.toHaveProperty("action")
  })
})

describe("the list of groups", () => {
  const summary = async (member: Member) => (await listGroupSummaries(member))[0]

  test("shows the last message with who wrote it, unread only for whoever didn't write it", async () => {
    const group = await general(ana)
    expect(await summary(ana)).toMatchObject({ name: "geral", preview: "Toda a equipe e os agentes", unread: false })
    // It looks like its agents, then its people.
    expect((await summary(ana)).looks).toEqual([
      ...[lia, otto].map(({ shape, color }) => ({ shape, color })),
      personLook(ana.id),
      personLook(bia.id),
    ])
    const created = await createGroup(ana, { name: "Recepção", memberIds: [], agentIds: [otto.id] })
    expect((await listGroupSummaries(ana)).find((row) => row.id === created.id)?.looks).toEqual([
      { shape: otto.shape, color: otto.color },
      personLook(ana.id),
    ])

    await sendGroupMessage(ana, group, "Bom  dia\ngente", { model: silent, now })
    expect(await summary(ana)).toMatchObject({ preview: "Você: Bom dia gente", unread: false, lastAt: now })
    expect(await summary(bia)).toMatchObject({ preview: "Ana: Bom dia gente", unread: true })

    await markGroupRead(bia, group, now, later(1))
    expect((await summary(bia)).unread).toBe(false)
  })
})
