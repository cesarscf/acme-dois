import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { createOrganization, joinOrganization, resetDatabase } from "@/test/fixtures"
import { scriptedModel, says, uses } from "@/test/scripted-model"
import { createAppointment, findAppointment, listAppointments } from "../agenda/appointments"
import { createCustomer } from "../agenda/customers"
import type { Model } from "../agent/model"
import { introText, setupPrompt, welcomeText } from "../agent/prompt"
import { unanswered } from "../agent/run-turn"
import type { Member } from "../member"
import { type Agent, createAgents, findAgent, listAgents } from "../organization/agents"
import { saveOrganizationProfile } from "../organization/profile"
import { actOnCard, listMessages, sendMessage } from "./conversation"

// Friday 2026-10-23, 09:00 in São Paulo.
const now = new Date("2026-10-23T12:00:00Z")

let ana: Member
let bia: Member
let setup: Agent
let carla: { id: string; name: string }

beforeEach(async () => {
  await resetDatabase()
  ;[ana, bia] = await createOrganization("Ana", "Bia")
  const [first] = await listAgents(ana)
  setup = (await findAgent(ana, first.id))!
  carla = await createCustomer(ana, { name: "Carla" })
})

// A team agent the way the setup agent would make it.
async function teamAgent(overrides: { tools?: string[]; actsAlone?: string[] } = {}) {
  const [created] = await createAgents(ana, [
    {
      name: "Lia",
      role: "Secretária da agenda",
      instructions: "Você marca as sessões que a equipe pedir.",
      tools: overrides.tools ?? ["find_customers", "read_agenda", "create_appointment", "cancel_appointment"],
      actsAlone: overrides.actsAlone ?? ["create_appointment"],
      shape: "round",
      color: "#2f80ff",
    },
  ])
  return (await findAgent(ana, created.id))!
}

const shown = async (member: Member, agent: Agent) =>
  (await listMessages(member, agent)).map(({ author, text, card }) => ({ author, text, card }))

const book = () =>
  createAppointment(ana, { customerId: carla.id, memberId: ana.id, startsAt: new Date("2026-10-23T13:00:00Z") })

const createAt15 = {
  customer_id: "",
  day: "2026-10-23",
  time: "15:00",
  duration_minutes: null,
  kind: null,
  member_id: null,
}

describe("the setup agent", () => {
  test("opens every member's conversation with the app's welcome", async () => {
    expect(await shown(ana, setup)).toEqual([{ author: "agent", text: welcomeText("Ana"), card: null }])
    expect((await shown(bia, setup))[0].text).toStartWith("Oi, Bia!")
  })

  test("answers with its own prompt and only the setup tools", async () => {
    const { model, requests } = scriptedModel(says("Que bom! Quantas pessoas atendem?"))
    await sendMessage(ana, setup, "Somos uma clínica de fisioterapia", { model, now })
    expect(requests[0].system).toBe(setupPrompt)
    expect(requests[0].tools.map((tool) => tool.name)).toEqual([
      "save_organization_profile",
      "read_organization",
      "propose_team",
      "choose_agent_look",
      "invite_member",
    ])
    expect((await shown(ana, setup)).map((row) => row.author)).toEqual(["agent", "member", "agent"])
  })

  test("builds the team with the name and look the member settled in the card", async () => {
    const proposal = {
      name: "Lia",
      role: "Secretária da agenda",
      instructions: "Você marca as sessões.",
      tools: ["create_appointment"],
      acts_alone: [],
    }
    const { model } = scriptedModel(uses({ name: "propose_team", input: { agents: [proposal] } }), says("Confere?"))
    await sendMessage(ana, setup, "Pode montar", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    expect(card.card).toMatchObject({ type: "team", status: "pending", agents: [{ name: "Lia" }] })
    expect((await listAgents(ana)).map((agent) => agent.name)).toEqual(["Acme Bot"])

    const settled = { name: "Nina", shape: "blob", color: "#ff5cae" } as const
    expect(await actOnCard(ana, setup, card.id, "accept", { team: [settled] })).toMatchObject({
      status: "accepted",
      agents: [settled],
    })
    const [, nina] = await listAgents(ana)
    expect(nina).toMatchObject({ name: "Nina", shape: "blob", color: "#ff5cae", role: "Secretária da agenda" })
    // Everything was confirmed at once: no look card follows.
    expect((await listMessages(ana, setup)).filter((row) => row.card)).toHaveLength(1)

    const { model: next, requests } = scriptedModel(says("Já aparece ao lado."))
    await sendMessage(ana, setup, "Feito", { model: next, now })
    expect(requests[0].messages.at(-3)?.content).toBe(
      `[Aviso do Acme, não escrito pelo membro] Ana confirmou "Criar este agente?". Agentes criados, com o nome e a aparência que o membro escolheu: Nina (id ${nina.id}, forma blob, cor #ff5cae).`,
    )
  })

  test("keeps the proposed name and look when the member changed nothing", async () => {
    const proposal = { name: "Lia", role: "Secretária", instructions: "Marca.", tools: ["read_agenda"], acts_alone: [] }
    const { model } = scriptedModel(uses({ name: "propose_team", input: { agents: [proposal] } }), says("Confere?"))
    await sendMessage(ana, setup, "Pode montar", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    await actOnCard(ana, setup, card.id, "accept")
    expect((await listAgents(ana))[1]).toMatchObject({ name: "Lia", shape: "square", color: "#2f80ff" })
  })

  test("creates an unnamed proposal only once the member names it", async () => {
    const proposal = { name: null, role: "Consulta da agenda", instructions: "Lê a agenda.", tools: ["read_agenda"], acts_alone: [] }
    const { model } = scriptedModel(uses({ name: "propose_team", input: { agents: [proposal] } }), says("Confere?"))
    await sendMessage(ana, setup, "Quero um agente que só consulta", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!

    expect(await actOnCard(ana, setup, card.id, "accept")).toMatchObject({ status: "stale" })
    expect(await listAgents(ana)).toHaveLength(1)
  })

  test("an unnamed proposal is created with the name written in the card", async () => {
    const proposal = { name: null, role: "Consulta da agenda", instructions: "Lê a agenda.", tools: ["read_agenda"], acts_alone: [] }
    const { model } = scriptedModel(uses({ name: "propose_team", input: { agents: [proposal] } }), says("Confere?"))
    await sendMessage(ana, setup, "Quero um agente que só consulta", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    const team = [{ name: "Rosa", shape: "star", color: "#14b8a6" }] as const
    expect(await actOnCard(ana, setup, card.id, "accept", { team: [...team] })).toMatchObject({ status: "accepted" })
    expect((await listAgents(ana))[1]).toMatchObject({ name: "Rosa", role: "Consulta da agenda" })
  })

  test("declining the proposal creates nobody", async () => {
    const proposal = { name: "Lia", role: "Secretária", instructions: "Marca.", tools: ["read_agenda"], acts_alone: [] }
    const { model } = scriptedModel(uses({ name: "propose_team", input: { agents: [proposal] } }), says("Confere?"))
    await sendMessage(ana, setup, "Pode montar", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    expect(await actOnCard(ana, setup, card.id, "decline")).toMatchObject({ status: "declined" })
    expect(await listAgents(ana)).toHaveLength(1)
  })

  test("nothing is created when the settled names clash", async () => {
    const proposal = { name: "Lia", role: "Secretária", instructions: "Marca.", tools: ["read_agenda"], acts_alone: [] }
    const { model } = scriptedModel(
      uses({ name: "propose_team", input: { agents: [proposal, { ...proposal, name: "Tom" }] } }),
      says("Confere?"),
    )
    await sendMessage(ana, setup, "Pode montar", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    const team = [
      { name: "Nina", shape: "blob", color: "#ff5cae" },
      { name: "nina", shape: "round", color: "#2ea603" },
    ] as const
    expect(await actOnCard(ana, setup, card.id, "accept", { team: [...team] })).toMatchObject({ status: "stale" })
    expect(await listAgents(ana)).toHaveLength(1)
  })

  test("sets an agent's look from the look card, once", async () => {
    const lia = await teamAgent()
    const { model } = scriptedModel(uses({ name: "choose_agent_look", input: { agent_id: lia.id } }), says("Escolhe aí."))
    await sendMessage(ana, setup, "Quero mudar a cara da Lia", { model, now })
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    expect(card.card).toMatchObject({ type: "look", status: "pending" })

    const look = { shape: "blob", color: "#ff5cae" } as const
    expect(await actOnCard(ana, setup, card.id, "choose", { look })).toEqual({
      type: "look",
      agentName: "Lia",
      look,
      status: "chosen",
    })
    expect(await findAgent(ana, lia.id)).toMatchObject(look)
    await actOnCard(ana, setup, card.id, "choose", { look: { shape: "square", color: "#2ea603" } })
    expect(await findAgent(ana, lia.id)).toMatchObject(look)
  })

  test("says nothing was done when the names got taken before the member confirmed", async () => {
    const proposal = { name: "Lia", role: "Secretária", instructions: "Marca.", tools: ["read_agenda"], acts_alone: [] }
    const { model, requests } = scriptedModel(
      uses({ name: "propose_team", input: { agents: [proposal] } }),
      says("Confere?"),
      says("Vamos escolher outro nome."),
    )
    await sendMessage(ana, setup, "Pode montar", { model, now })
    await teamAgent()
    const card = (await listMessages(ana, setup)).find((row) => row.card)!
    expect(await actOnCard(ana, setup, card.id, "accept")).toMatchObject({ status: "stale" })

    await sendMessage(ana, setup, "E agora?", { model, now })
    expect(requests[2].messages.at(-3)).toEqual({
      role: "user",
      content:
        '[Aviso do Acme, não escrito pelo membro] Ana tentou aplicar, mas nada foi feito em "Criar este agente?". Motivo: Já existe um agente com um desses nomes.',
    })
  })
})

describe("a team agent", () => {
  test("works from its charter and the organization's profile, with only its tools", async () => {
    await saveOrganizationProfile(ana, { about: "Pilates, sessões de 40 minutos.", appointmentMinutes: 40 })
    const lia = await teamAgent({ tools: ["find_customers", "read_agenda"] })
    const { model, requests } = scriptedModel(says("Oi!"))
    await sendMessage(ana, lia, "Oi", { model, now })

    expect(requests[0].system).toContain("Você é Lia, Secretária da agenda da clínica")
    expect(requests[0].system).toContain("Você marca as sessões que a equipe pedir.")
    expect(requests[0].system).toContain("Pilates, sessões de 40 minutos.")
    expect(requests[0].tools.map((tool) => tool.name)).toEqual(["find_customers", "read_agenda"])
    expect(requests[0].system).toContain(`"${introText(lia, "{nome do membro}")}"`)
    expect((await shown(ana, lia)).map((row) => row.author)).toEqual(["agent", "member", "agent"])
  })

  test("opens every member's conversation with its introduction, as soon as it exists", async () => {
    const lia = await teamAgent({
      tools: ["find_customers", "read_agenda", "create_appointment", "reschedule_appointment", "cancel_appointment"],
      actsAlone: ["create_appointment"],
    })
    expect(await shown(bia, lia)).toEqual([{ author: "agent", text: introText(lia, "Bia"), card: null }])
    expect(introText(lia, "Bia")).toBe(
      [
        "Oi, Bia! Eu sou Lia, Secretária da agenda. Acabei de chegar na equipe.",
        "Faço sem te perguntar: marcar sessões.",
        "Te pergunto antes de remarcar sessões.",
        "Cancelar uma sessão, só com a sua confirmação.",
        "",
        "Pra começar, me pergunte: “Quem eu atendo amanhã?”",
      ].join("\n"),
    )
  })

  test("welcomes someone who joined after it existed, in every conversation", async () => {
    const tati = await teamAgent({ tools: ["read_agenda", "create_appointment"], actsAlone: [] })
    const joana = await joinOrganization(ana.organizationId, "Joana", new Date(Date.now() + 60_000))

    const [intro] = await shown(joana, tati)
    expect(intro.text).toBe(introText(tati, "Joana", "joined"))
    expect(intro.text?.split("\n")[0]).toBe("Oi, Joana! Que bom ter você na equipe. Eu sou Lia, Secretária da agenda.")
    expect(intro.text).not.toContain("Acabei de chegar")

    const [welcome] = await shown(joana, setup)
    expect(welcome.text).toBe(welcomeText("Joana", "joined"))
    expect(welcome.text).toContain("Os agentes da equipe já estão na lista ao lado")

    // Ana was there before the agent, so it introduces itself to her as new.
    expect((await shown(ana, tati))[0].text).toContain("Acabei de chegar na equipe.")
  })

  test("an agent that only reads says so in its introduction", async () => {
    const lia = await teamAgent({ tools: ["find_customers", "read_agenda"], actsAlone: [] })
    expect(introText(lia, "Ana").split("\n")[1]).toBe("Eu leio a agenda e te conto o que você precisar.")
  })

  test("can't run a tool its charter doesn't give it, whatever the model asks", async () => {
    const lia = await teamAgent({ tools: ["read_agenda"], actsAlone: [] })
    const { model, requests } = scriptedModel(
      uses({ name: "create_appointment", input: { ...createAt15, customer_id: carla.id } }),
      says("Não consigo."),
    )
    await sendMessage(ana, lia, "Marca a Carla às 15h", { model, now })
    expect(requests[1].messages.at(-1)?.content).toMatchObject([{ is_error: true }])
    expect(await listAppointments(ana, { from: new Date(0), to: new Date("2100-01-01") })).toEqual([])
  })

  test("tells the agent who speaks, the team and the time", async () => {
    const lia = await teamAgent()
    const { model, requests } = scriptedModel(says("Oi, Ana!"))
    await sendMessage(ana, lia, "Oi", { model, now })
    const [first] = requests
    expect(first.messages[0]).toEqual({ role: "user", content: "Oi" })
    // Kept, not cleared at the next user message: a tool result counts as one.
    expect(first.messages[1]).toEqual({ role: "system", content: expect.any(String) })
    const context = first.messages[1].content as string
    expect(context).toContain("Agora: 2026-10-23 09:00")
    expect(context).toContain(`Quem fala com você: Ana (member_id ${ana.id})`)
    expect(context).toContain(`- Bia (member_id ${bia.id})`)
  })

  test("resends the whole transcript, unchanged, on the next turn", async () => {
    const lia = await teamAgent()
    const { model, requests } = scriptedModel(says("Oi!"), says("Tudo bem."))
    await sendMessage(ana, lia, "Oi", { model, now })
    await sendMessage(ana, lia, "Tudo bem?", { model, now })
    expect(requests[1].messages.slice(0, 3)).toEqual([
      ...requests[0].messages,
      { role: "assistant", content: [{ type: "text", text: "Oi!" }] },
    ])
  })

  test("keeps each conversation apart: per member and per agent", async () => {
    const lia = await teamAgent()
    const { model } = scriptedModel(says("Oi, Ana!"))
    await sendMessage(ana, lia, "Oi", { model, now })
    expect(await listMessages(bia, lia)).toHaveLength(1)
    expect(await listMessages(ana, setup)).toHaveLength(1)
  })

  test("answers that it couldn't, and leaves the transcript as it was, when the model fails", async () => {
    const lia = await teamAgent()
    spyOn(console, "error").mockImplementationOnce(() => {})
    const failing: Model = async () => {
      throw new Error("overloaded")
    }
    await sendMessage(ana, lia, "Oi", { model: failing, now })
    expect((await shown(ana, lia)).at(-1)).toEqual({ author: "agent", text: unanswered, card: null })

    const { model, requests } = scriptedModel(says("Oi!"))
    await sendMessage(ana, lia, "Oi de novo", { model, now })
    expect(requests[0].messages.map((entry) => entry.role)).toEqual(["user", "system"])
  })
})

describe("actOnCard", () => {
  async function askToCancel(lia: Agent) {
    const original = await book()
    const { model } = scriptedModel(
      uses({ name: "cancel_appointment", input: { appointment_id: original.id, reason: null } }),
      says("Confirma?"),
    )
    await sendMessage(ana, lia, "Cancela a Carla", { model, now })
    const cardMessage = (await listMessages(ana, lia)).find((row) => row.card)!
    return { original, cardMessage }
  }

  test("never sends a card's action to the browser", async () => {
    const { cardMessage } = await askToCancel(await teamAgent())
    expect(cardMessage.card).toMatchObject({ type: "approval", status: "pending" })
    expect(cardMessage).not.toHaveProperty("action")
  })

  test("accepting a cancellation cancels the session and tells the agent", async () => {
    const lia = await teamAgent()
    const { original, cardMessage } = await askToCancel(lia)
    expect(await actOnCard(ana, lia, cardMessage.id, "accept")).toMatchObject({ status: "accepted" })
    expect((await findAppointment(ana, original.id))?.status).toBe("cancelled")

    const { model, requests } = scriptedModel(says("Pronto."))
    await sendMessage(ana, lia, "Obrigada", { model, now })
    expect(requests[0].messages.at(-3)).toEqual({
      role: "user",
      content: '[Aviso do Acme, não escrito pelo membro] Ana confirmou "Cancelar a sessão?".',
    })
  })

  test("declining leaves the session scheduled", async () => {
    const lia = await teamAgent()
    const { original, cardMessage } = await askToCancel(lia)
    expect(await actOnCard(ana, lia, cardMessage.id, "decline")).toMatchObject({ status: "declined" })
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })

  test("a cancellation is stale when the session changed after the agent asked", async () => {
    const lia = await teamAgent({ tools: ["read_agenda", "cancel_appointment", "assign_appointment"], actsAlone: ["assign_appointment"] })
    const { original, cardMessage } = await askToCancel(lia)
    const { model } = scriptedModel(
      uses({ name: "assign_appointment", input: { appointment_id: original.id, member_id: bia.id } }),
      says("Agora com a Bia."),
    )
    await sendMessage(ana, lia, "Passa a Carla para a Bia", { model, now })
    expect(await actOnCard(ana, lia, cardMessage.id, "accept")).toMatchObject({ status: "stale" })
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })

  test("what the agent asked to do is done once confirmed, with a receipt that undoes it", async () => {
    const lia = await teamAgent({ actsAlone: [] })
    const { model, requests } = scriptedModel(
      uses({ name: "create_appointment", input: { ...createAt15, customer_id: carla.id } }),
      says("Confirma?"),
      says("Marcado."),
    )
    await sendMessage(ana, lia, "Marca a Carla às 15h", { model, now })
    const approval = (await listMessages(ana, lia)).find((row) => row.card)!
    expect(approval.card).toMatchObject({ title: "Marcar a sessão?", status: "pending" })

    // Confirmed a few minutes later, as it would be.
    const confirmedAt = new Date(now.getTime() + 5 * 60_000)
    expect(await actOnCard(ana, lia, approval.id, "accept", { now: confirmedAt })).toMatchObject({
      status: "accepted",
    })
    const cards = (await listMessages(ana, lia)).flatMap((row) => (row.card ? [row] : []))
    expect(cards.map((row) => [row.card && "title" in row.card && row.card.title, row.card?.status])).toEqual([
      ["Marcar a sessão?", "accepted"],
      ["Sessão marcada", "applied"],
    ])

    await sendMessage(ana, lia, "Valeu", { model, now })
    expect(requests[2].messages.at(-3)?.content).toStartWith(
      '[Aviso do Acme, não escrito pelo membro] Ana confirmou "Marcar a sessão?". Resultado: {"appointment_id":',
    )

    expect(await actOnCard(ana, lia, cards[1].id, "undo")).toMatchObject({ status: "undone" })
    expect(await listAppointments(ana, { from: new Date(0), to: new Date("2100-01-01") })).toMatchObject([
      { status: "cancelled" },
    ])
  })

  test("nothing is done when what the agent asked can't be done anymore", async () => {
    const lia = await teamAgent({ actsAlone: [] })
    const { model } = scriptedModel(
      uses({ name: "create_appointment", input: { ...createAt15, customer_id: carla.id } }),
      says("Confirma?"),
    )
    await sendMessage(ana, lia, "Marca a Carla às 15h", { model, now })
    const approval = (await listMessages(ana, lia)).find((row) => row.card)!
    const later = new Date("2026-10-23T19:00:00Z")
    expect(await actOnCard(ana, lia, approval.id, "accept", { now: later })).toMatchObject({ status: "stale" })
    expect(await listAppointments(ana, { from: new Date(0), to: new Date("2100-01-01") })).toEqual([])
  })

  test("undoing a receipt puts the agenda back, once", async () => {
    const lia = await teamAgent()
    const { model } = scriptedModel(
      uses({ name: "create_appointment", input: { ...createAt15, customer_id: carla.id } }),
      says("Marquei."),
    )
    await sendMessage(ana, lia, "Marca a Carla às 15h", { model, now })
    const receipt = (await listMessages(ana, lia)).find((row) => row.card)!
    expect(await actOnCard(ana, lia, receipt.id, "undo")).toMatchObject({ status: "undone" })
    expect(await actOnCard(ana, lia, receipt.id, "undo")).toMatchObject({ status: "undone" })
  })

  test("another member can't act on someone else's card", async () => {
    const lia = await teamAgent()
    const { original, cardMessage } = await askToCancel(lia)
    expect(await actOnCard(bia, lia, cardMessage.id, "accept")).toBeUndefined()
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })
})
