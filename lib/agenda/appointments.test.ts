import { beforeEach, describe, expect, test } from "bun:test"
import { createClinic, resetDatabase } from "@/test/fixtures"
import {
  AgendaError,
  applyRestores,
  assignAppointment,
  cancelAppointment,
  createAppointment,
  findAppointment,
  listAppointments,
  rescheduleAppointment,
  restoreOf,
} from "./appointments"
import { createCustomer } from "./customers"

const at = (iso: string) => new Date(iso)

let ana: Awaited<ReturnType<typeof createClinic>>[number]
let bia: typeof ana
let customerId: string

beforeEach(async () => {
  await resetDatabase()
  ;[ana, bia] = await createClinic("Ana", "Bia")
  customerId = (await createCustomer(ana, { name: "Carla" })).id
})

const book = (startsAt = "2026-10-23T13:00:00Z") =>
  createAppointment(ana, { customerId, memberId: ana.id, startsAt: at(startsAt) })

describe("createAppointment", () => {
  test("books 50 minutes by default", async () => {
    const created = await book()
    expect(created.durationMinutes).toBe(50)
    expect(created.status).toBe("scheduled")
  })

  test("refuses a customer from another clinic", async () => {
    const [other] = await createClinic("Outra")
    const stranger = await createCustomer(other, { name: "Dora" })
    await expect(
      createAppointment(ana, { customerId: stranger.id, memberId: null, startsAt: at("2026-10-23T13:00:00Z") }),
    ).rejects.toBeInstanceOf(AgendaError)
  })

  test("refuses someone outside the team as who attends", async () => {
    const [other] = await createClinic("Outra")
    await expect(
      createAppointment(ana, { customerId, memberId: other.id, startsAt: at("2026-10-23T13:00:00Z") }),
    ).rejects.toThrow("Quem atende precisa ser da equipe.")
  })
})

test("listAppointments returns one clinic's day, in order, with names", async () => {
  await book("2026-10-23T15:00:00Z")
  await book("2026-10-23T13:00:00Z")
  await book("2026-10-24T13:00:00Z")
  const [other] = await createClinic("Outra")
  const theirs = await createCustomer(other, { name: "Dora" })
  await createAppointment(other, { customerId: theirs.id, memberId: null, startsAt: at("2026-10-23T14:00:00Z") })

  const day = await listAppointments(ana, { from: at("2026-10-23T03:00:00Z"), to: at("2026-10-24T03:00:00Z") })
  expect(day.map((row) => [row.startsAt.toISOString(), row.customer, row.attendedBy])).toEqual([
    ["2026-10-23T13:00:00.000Z", "Carla", "Ana"],
    ["2026-10-23T15:00:00.000Z", "Carla", "Ana"],
  ])
})

describe("rescheduleAppointment", () => {
  test("cancels the old one and books a new one pointing back to it", async () => {
    const original = await book()
    const { cancelled, rebooked } = await rescheduleAppointment(ana, original.id, {
      startsAt: at("2026-10-24T13:00:00Z"),
    })
    expect(cancelled.status).toBe("cancelled")
    expect(rebooked).toMatchObject({ rescheduledFromId: original.id, memberId: ana.id, status: "scheduled" })
  })

  test("refuses one that is no longer scheduled", async () => {
    const original = await book()
    await cancelAppointment(ana, original.id)
    await expect(rescheduleAppointment(ana, original.id, { startsAt: at("2026-10-24T13:00:00Z") })).rejects.toThrow(
      "Essa sessão não está mais agendada.",
    )
  })

  test("can't touch another clinic's appointment", async () => {
    const [other] = await createClinic("Outra")
    const original = await book()
    await expect(rescheduleAppointment(other, original.id, { startsAt: at("2026-10-24T13:00:00Z") })).rejects.toThrow(
      "Essa sessão não existe na agenda.",
    )
  })
})

test("assignAppointment changes who attends", async () => {
  const original = await book()
  const { updated } = await assignAppointment(ana, original.id, bia.id)
  expect(updated.memberId).toBe(bia.id)
  await expect(assignAppointment(ana, original.id, bia.id)).rejects.toThrow("já atende")
})

describe("cancelAppointment", () => {
  test("is stale when the appointment changed since the version given", async () => {
    const original = await book()
    await assignAppointment(ana, original.id, bia.id)
    expect(await cancelAppointment(ana, original.id, original.updatedAt)).toBe("stale")
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })

  test("cancels at the version given", async () => {
    const original = await book()
    const cancelled = await cancelAppointment(ana, original.id, original.updatedAt)
    expect(cancelled).toMatchObject({ status: "cancelled" })
  })
})

describe("applyRestores", () => {
  test("undoes a rescheduling", async () => {
    const original = await book()
    const { cancelled, rebooked } = await rescheduleAppointment(ana, original.id, {
      startsAt: at("2026-10-24T13:00:00Z"),
    })
    const result = await applyRestores(ana, [
      restoreOf(rebooked, { status: "cancelled" }),
      restoreOf(cancelled, { status: "scheduled" }),
    ])
    expect(result).toBe("restored")
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
    expect((await findAppointment(ana, rebooked.id))?.status).toBe("cancelled")
  })

  test("restores nothing when any appointment changed since", async () => {
    const original = await book()
    const { cancelled, rebooked } = await rescheduleAppointment(ana, original.id, {
      startsAt: at("2026-10-24T13:00:00Z"),
    })
    await assignAppointment(ana, rebooked.id, bia.id)
    const result = await applyRestores(ana, [
      restoreOf(cancelled, { status: "scheduled" }),
      restoreOf(rebooked, { status: "cancelled" }),
    ])
    expect(result).toBe("stale")
    expect((await findAppointment(ana, original.id))?.status).toBe("cancelled")
  })
})
