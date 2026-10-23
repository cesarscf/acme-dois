import { beforeEach, describe, expect, test } from "bun:test"
import { createOrganization, resetDatabase } from "@/test/fixtures"
import { createAppointment, findAppointment, listAppointments } from "../agenda/appointments"
import { createCustomer } from "../agenda/customers"
import type { Member } from "../member"
import { agendaTools } from "./agenda-tools"
import { createToolRegistry, type ToolContext } from "./tool-registry"

const registry = createToolRegistry(agendaTools)
const confirmable = agendaTools.filter((tool) => tool.confirm).map((tool) => tool.name)
const timeZone = "America/Sao_Paulo"
// Friday 2026-10-23, 09:00 in São Paulo.
const now = new Date("2026-10-23T12:00:00Z")

let ana: Member
let bia: Member
let carla: { id: string; name: string }
let context: ToolContext

beforeEach(async () => {
  await resetDatabase()
  ;[ana, bia] = await createOrganization("Ana", "Bia")
  carla = await createCustomer(ana, { name: "Carla" })
  // Acting alone wherever it may, so each test reaches the tool itself.
  context = { member: ana, now, timeZone, actsAlone: confirmable, appointmentMinutes: null }
})

const run = (name: string, input: unknown) =>
  registry.execute({ id: "toolu_1", name, input }, context)

const output = (execution: Awaited<ReturnType<typeof run>>) =>
  JSON.parse(execution.result.content as string)

const book = (startsAt = "2026-10-23T13:00:00Z") =>
  createAppointment(ana, { customerId: carla.id, memberId: ana.id, startsAt: new Date(startsAt) })

describe("the registry", () => {
  test("describes each tool by a plain JSON schema", () => {
    const create = registry.definitions.find((tool) => tool.name === "create_appointment")
    expect(create?.input_schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["customer_id", "day", "time", "duration_minutes", "kind", "member_id"],
    })
    expect(create?.input_schema).not.toHaveProperty("$schema")
  })

  test("turns down input that doesn't match the schema", async () => {
    const execution = await run("create_appointment", { customer_id: "C-3", day: "amanhã" })
    expect(execution.result.is_error).toBe(true)
    expect(execution.result.content).toStartWith("Entrada inválida para create_appointment")
    expect(execution.card).toBeUndefined()
  })

  test("turns down a tool that doesn't exist", async () => {
    const execution = await run("delete_everything", {})
    expect(execution.result).toMatchObject({ is_error: true, content: "Não existe a ferramenta delete_everything." })
  })
})

test("find_customers searches by name", async () => {
  await createCustomer(ana, { name: "Beatriz" })
  expect(output(await run("find_customers", { query: "car" }))).toEqual([
    { id: carla.id, name: "Carla", phone: null },
  ])
})

test("read_agenda reads one organization day", async () => {
  const booked = await book()
  await book("2026-10-24T13:00:00Z")
  expect(output(await run("read_agenda", { day: "2026-10-23" }))).toEqual({
    day: "2026-10-23",
    appointments: [
      {
        id: booked.id,
        time: "10:00",
        customer: "Carla",
        customer_id: carla.id,
        duration_minutes: 50,
        kind: null,
        attended_by: "Ana",
        status: "scheduled",
      },
    ],
  })
})

describe("create_appointment", () => {
  const input = {
    customer_id: "",
    day: "2026-10-23",
    time: "15:00",
    duration_minutes: null,
    kind: "Avaliação",
    member_id: null,
  }

  test("books with whoever asked and shows a receipt that undoes it", async () => {
    const execution = await run("create_appointment", { ...input, customer_id: carla.id })
    expect(execution.card).toEqual({
      type: "receipt",
      title: "Sessão marcada",
      detail: "Carla, sex 23/10, 15:00, com Ana.",
      status: "applied",
      undoable: true,
    })
    const { appointment_id } = output(execution)
    const created = await findAppointment(ana, appointment_id)
    expect(created).toMatchObject({ memberId: ana.id, durationMinutes: 50, kind: "Avaliação" })
    expect(execution.action).toEqual({
      kind: "undo",
      restores: [{ id: appointment_id, updatedAt: created!.updatedAt.toISOString(), restore: { status: "cancelled" } }],
    })
  })

  test("refuses a time that has passed", async () => {
    const execution = await run("create_appointment", { ...input, customer_id: carla.id, time: "08:00" })
    expect(execution.result).toMatchObject({ is_error: true, content: "Esse horário já passou." })
  })

  test("refuses a customer of another organization", async () => {
    const [other] = await createOrganization("Outra")
    const stranger = await createCustomer(other, { name: "Dora" })
    const execution = await run("create_appointment", { ...input, customer_id: stranger.id })
    expect(execution.result.is_error).toBe(true)
    expect(await listAppointments(other, { from: new Date(0), to: new Date("2100-01-01") })).toEqual([])
  })
})

test("reschedule_appointment rebooks and its undo puts both back", async () => {
  const original = await book()
  const execution = await run("reschedule_appointment", {
    appointment_id: original.id,
    day: "2026-10-26",
    time: "09:30",
    member_id: bia.id,
  })
  expect(execution.card).toMatchObject({
    title: "Sessão remarcada",
    detail: "Carla, de sex 23/10, 10:00 para seg 26/10, 09:30, com Bia.",
  })
  const { appointment_id, replaces } = output(execution)
  expect(replaces).toBe(original.id)
  expect(execution.action).toMatchObject({
    kind: "undo",
    restores: [
      { id: appointment_id, restore: { status: "cancelled" } },
      { id: original.id, restore: { status: "scheduled" } },
    ],
  })
})

test("assign_appointment's undo gives the session back to who attended", async () => {
  const original = await book()
  const execution = await run("assign_appointment", { appointment_id: original.id, member_id: bia.id })
  expect(execution.card).toMatchObject({ detail: "Carla, sex 23/10, 10:00, agora com Bia." })
  expect(execution.action).toMatchObject({ restores: [{ id: original.id, restore: { memberId: ana.id } }] })
})

describe("cancel_appointment", () => {
  test("only asks: the session stays scheduled behind a pending approval", async () => {
    const original = await book()
    const execution = await run("cancel_appointment", { appointment_id: original.id, reason: "Viagem" })
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
    expect(execution.card).toEqual({
      type: "approval",
      title: "Cancelar a sessão?",
      rows: [
        { label: "Cliente", value: "Carla" },
        { label: "Sessão", value: "sex 23/10, 10:00" },
        { label: "Atende", value: "Ana" },
        { label: "Motivo", value: "Viagem" },
      ],
      status: "pending",
    })
    expect(execution.action).toEqual({
      kind: "cancel",
      appointmentId: original.id,
      updatedAt: original.updatedAt.toISOString(),
    })
  })

  test("refuses a session of another organization", async () => {
    const [other] = await createOrganization("Outra")
    const original = await book()
    const execution = await registry.execute(
      { id: "toolu_1", name: "cancel_appointment", input: { appointment_id: original.id, reason: null } },
      { ...context, member: other },
    )
    expect(execution.result).toMatchObject({ is_error: true, content: "Essa sessão não existe na agenda." })
  })
})

describe("an agent that may not act alone", () => {
  const input = {
    day: "2026-10-23",
    time: "15:00",
    duration_minutes: null,
    kind: null,
    member_id: null,
  }

  test("shows what it would do for a member to confirm, and changes nothing", async () => {
    context.actsAlone = []
    const execution = await run("create_appointment", { ...input, customer_id: carla.id })
    expect(execution.card).toEqual({
      type: "approval",
      title: "Marcar a sessão?",
      rows: [
        { label: "Cliente", value: "Carla" },
        { label: "Quando", value: "sex 23/10, 15:00 (50 min)" },
        { label: "Atende", value: "Ana" },
      ],
      status: "pending",
    })
    expect(execution.action).toEqual({
      kind: "apply",
      tool: "create_appointment",
      input: { ...input, customer_id: carla.id },
    })
    expect(await listAppointments(ana, { from: new Date(0), to: new Date("2100-01-01") })).toEqual([])
  })

  test("still refuses what it couldn't do, before asking", async () => {
    context.actsAlone = []
    const execution = await run("create_appointment", { ...input, customer_id: carla.id, time: "08:00" })
    expect(execution.result).toMatchObject({ is_error: true, content: "Esse horário já passou." })
    expect(execution.card).toBeUndefined()
  })

  test("does it once a member confirmed", async () => {
    const execution = await registry.execute(
      { id: "confirmed", name: "create_appointment", input: { ...input, customer_id: carla.id } },
      { ...context, actsAlone: [], confirmed: true },
    )
    expect(execution.card).toMatchObject({ type: "receipt", title: "Sessão marcada" })
  })
})

test("a new appointment lasts what the organization said", async () => {
  context.appointmentMinutes = 40
  const execution = await run("create_appointment", {
    customer_id: carla.id,
    day: "2026-10-23",
    time: "15:00",
    duration_minutes: null,
    kind: null,
    member_id: null,
  })
  const created = await findAppointment(ana, output(execution).appointment_id)
  expect(created?.durationMinutes).toBe(40)
})
