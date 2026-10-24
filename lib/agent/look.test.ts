import { expect, test } from "bun:test"
import { avatarColors, avatarShapes, nextLook } from "./look"

test("nextLook takes a color the team isn't using and the next shape", () => {
  expect(nextLook([])).toEqual({ shape: "drop", color: avatarColors[0] })
  expect(nextLook([{ shape: "drop", color: avatarColors[0] }])).toEqual({ shape: "square", color: avatarColors[1] })
})

test("nextLook still gives a look once every color is taken", () => {
  const taken = avatarColors.map((color, index) => ({ shape: avatarShapes[index % 4], color }))
  expect(avatarColors).toContain(nextLook(taken).color as (typeof avatarColors)[number])
})
