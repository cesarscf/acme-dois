import { describe, expect, test } from "bun:test"
import type { Appointment } from "../agenda/appointments"
import type { Member } from "../member"
import { noticesOf } from "./notices"

// Friday 2026-10-23, 09:00 in São Paulo.
const now = new Date("2026-10-23T12:00:00Z")

const ana = { id: "ana", name: "Ana" } as Member
const names = new Map([
  ["ana", "Ana"],
  ["bia", "Bia"],
  ["caio", "Caio"],
])

const session = (memberId: string | null, startsAt = "2026-10-23T17:00:00Z"): Appointment => ({
  id: crypto.randomUUID(),
  organizationId: "clinic",
  customerId: "carla",
  memberId,
  startsAt: new Date(startsAt),
  durationMinutes: 50,
  kind: null,
  status: "scheduled",
  rescheduledFromId: null,
  createdAt: now,
  updatedAt: now,
})

const of = (from: Appointment | null, to: Appointment | null, via: "asked" | "confirmed" | "undone" = "asked") =>
  noticesOf({ from, to }, { actor: ana, via, customer: "Carla", names, now })

describe("noticesOf", () => {
  test("tells whoever attends a booked session, never whoever booked it", () => {
    expect(of(null, session("bia"))).toEqual([
      { memberId: "bia", text: "A pedido de Ana, marquei uma sessão para você: Carla, sex 23/10, 14:00 (50 min)." },
    ])
    expect(of(null, session("ana"))).toEqual([])
    expect(of(null, session(null))).toEqual([])
  })

  test("says how the change came about", () => {
    expect(of(session("bia"), null, "confirmed")[0].text).toBe(
      "Com a confirmação de Ana, cancelei uma sessão sua: Carla, sex 23/10, 14:00.",
    )
    expect(of(session("bia"), null, "undone")[0].text).toStartWith("Desfazendo uma mudança a pedido de Ana, cancelei")
  })

  test("a session passed on tells who gave it up and who takes it", () => {
    expect(of(session("bia"), session("caio")).map(({ memberId, text }) => [memberId, text])).toEqual([
      ["bia", "A pedido de Ana, passei uma sessão sua para Caio: Carla, sex 23/10, 14:00."],
      ["caio", "A pedido de Ana, passei para você uma sessão que era de Bia: Carla, sex 23/10, 14:00."],
    ])
  })

  test("a rescheduling says where the session went", () => {
    const later = "2026-10-24T13:00:00Z"
    expect(of(session("bia"), session("bia", later))).toEqual([
      { memberId: "bia", text: "A pedido de Ana, remarquei uma sessão sua: Carla, de sex 23/10, 14:00 para sáb 24/10, 10:00." },
    ])
    expect(of(session("bia"), session("caio", later)).map(({ text }) => text)).toEqual([
      "A pedido de Ana, passei uma sessão sua para Caio: Carla, sex 23/10, 14:00, remarcada para sáb 24/10, 10:00.",
      "A pedido de Ana, passei para você uma sessão que era de Bia: Carla, sáb 24/10, 10:00 (antes sex 23/10, 14:00).",
    ])
  })

  test("says when a session is left with nobody to attend it", () => {
    expect(of(session("bia"), session(null))[0].text).toBe(
      "A pedido de Ana, tirei você de uma sessão, que ficou sem ninguém para atender: Carla, sex 23/10, 14:00.",
    )
    expect(of(session(null), session("bia"))[0].text).toBe(
      "A pedido de Ana, passei para você uma sessão que estava sem ninguém para atender: Carla, sex 23/10, 14:00.",
    )
  })

  test("nothing for a session that is over, or someone who left the team", () => {
    expect(of(session("bia", "2026-10-23T11:00:00Z"), null)).toEqual([])
    expect(of(null, session("joana"))).toEqual([])
  })
})
