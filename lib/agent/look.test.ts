import { describe, expect, test } from "bun:test"
import { avatarColors, avatarShapes, groupLooks, nextLook, personLook } from "./look"

test("nextLook takes a color the team isn't using and the next shape", () => {
  expect(nextLook([])).toEqual({ shape: "drop", color: avatarColors[0] })
  expect(nextLook([{ shape: "drop", color: avatarColors[0] }])).toEqual({ shape: "square", color: avatarColors[1] })
})

test("nextLook still gives a look once every color is taken", () => {
  const taken = avatarColors.map((color, index) => ({ shape: avatarShapes[index % 4], color }))
  expect(avatarColors).toContain(nextLook(taken).color as (typeof avatarColors)[number])
})

describe("groupLooks", () => {
  test("shows the agents, then the people, four at most", () => {
    const agents = [
      { shape: "square", color: "#2f80ff" },
      { shape: "drop", color: "#2ea603" },
    ] as const
    expect(groupLooks([...agents], ["ana", "bia", "caio"])).toEqual([...agents, personLook("ana"), personLook("bia")])
  })

  test("gives each person the same rounded mascot every time", () => {
    expect(personLook("ana")).toEqual(personLook("ana"))
    expect(["round", "blob", "egg", "drop", "bean", "cloud"]).toContain(personLook("ana").shape)
  })
})
