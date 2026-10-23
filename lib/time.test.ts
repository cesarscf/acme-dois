import { describe, expect, test } from "bun:test"
import { addDays, appointmentLabel, dayIn, dayRange, timeIn, zonedInstant } from "./time"

const saoPaulo = "America/Sao_Paulo"

describe("zonedInstant", () => {
  test("reads the wall clock of the clinic's zone", () => {
    expect(zonedInstant("2026-10-23", "10:00", saoPaulo).toISOString()).toBe(
      "2026-10-23T13:00:00.000Z",
    )
  })

  test("follows a zone across a change of offset", () => {
    // New York leaves daylight saving on 2026-11-01.
    expect(zonedInstant("2026-10-31", "09:00", "America/New_York").toISOString()).toBe(
      "2026-10-31T13:00:00.000Z",
    )
    expect(zonedInstant("2026-11-02", "09:00", "America/New_York").toISOString()).toBe(
      "2026-11-02T14:00:00.000Z",
    )
  })

  test("is Invalid Date for a malformed day", () => {
    expect(Number.isNaN(zonedInstant("2026-13-40", "10:00", saoPaulo).getTime())).toBe(true)
  })

  test("round-trips through dayIn and timeIn", () => {
    const instant = zonedInstant("2026-01-05", "23:30", saoPaulo)
    expect(dayIn(instant, saoPaulo)).toBe("2026-01-05")
    expect(timeIn(instant, saoPaulo)).toBe("23:30")
  })
})

test("addDays crosses months and years", () => {
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
})

test("dayRange spans the clinic's whole day", () => {
  const { from, to } = dayRange("2026-10-23", saoPaulo)
  expect(from.toISOString()).toBe("2026-10-23T03:00:00.000Z")
  expect(to.toISOString()).toBe("2026-10-24T03:00:00.000Z")
})

test("appointmentLabel names the weekday in pt-BR", () => {
  expect(appointmentLabel(zonedInstant("2026-10-23", "10:00", saoPaulo), saoPaulo)).toBe(
    "sex 23/10, 10:00",
  )
})
