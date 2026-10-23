// Days are aaaa-mm-dd and times HH:MM, both as the clinic reads them in its time zone.

const partsIn = (instant: Date, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  )

export function dayIn(instant: Date, timeZone: string) {
  const { year, month, day } = partsIn(instant, timeZone)
  return `${year}-${month}-${day}`
}

export function timeIn(instant: Date, timeZone: string) {
  const { hour, minute } = partsIn(instant, timeZone)
  return `${hour}:${minute}`
}

// How far the zone's wall clock is ahead of UTC at that instant.
function offsetMs(instant: Date, timeZone: string) {
  const { year, month, day, hour, minute } = partsIn(instant, timeZone)
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  return wall - Math.floor(instant.getTime() / 60_000) * 60_000
}

// The instant a wall clock in `timeZone` shows `day` at `time`; Invalid Date for a malformed one.
export function zonedInstant(day: string, time: string, timeZone: string) {
  const wall = new Date(`${day}T${time}:00Z`).getTime()
  if (Number.isNaN(wall)) return new Date(Number.NaN)
  const guess = wall - offsetMs(new Date(wall), timeZone)
  // A second pass for when the guess landed across a change of offset.
  return new Date(wall - offsetMs(new Date(guess), timeZone))
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// The instants a clinic day starts and ends.
export const dayRange = (day: string, timeZone: string) => ({
  from: zonedInstant(day, "00:00", timeZone),
  to: zonedInstant(addDays(day, 1), "00:00", timeZone),
})

const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

// "sex 23/10, 10:00"
export function appointmentLabel(startsAt: Date, timeZone: string) {
  const day = dayIn(startsAt, timeZone)
  const weekday = weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]
  return `${weekday} ${day.slice(8, 10)}/${day.slice(5, 7)}, ${timeIn(startsAt, timeZone)}`
}
