import { describe, expect, test } from "bun:test"
import { mentionBeingTyped, mentionsIn } from "./mentions"

const lia = { id: "lia", name: "Lia" }
const liaSouza = { id: "lia-souza", name: "Lia Souza" }
const otto = { id: "otto", name: "Otto" }
const agents = [lia, liaSouza, otto]

describe("mentionsIn", () => {
  test("finds who was called, in order, once each", () => {
    expect(mentionsIn("@otto e @Lia, vejam isso. @Otto?", agents)).toEqual([otto, lia])
  })

  test("prefers the longest name that fits", () => {
    expect(mentionsIn("@Lia Souza marca a Carla", agents)).toEqual([liaSouza])
  })

  test("only whole names after an @ count", () => {
    expect(mentionsIn("Lia, @Liana e ana@lia.com", agents)).toEqual([])
    expect(mentionsIn("(@Lia)", agents)).toEqual([lia])
  })
})

describe("mentionBeingTyped", () => {
  test("is what follows an @ right before the caret", () => {
    expect(mentionBeingTyped("Oi @Li")).toBe("Li")
    expect(mentionBeingTyped("@")).toBe("")
    expect(mentionBeingTyped("Oi @Lia Sou")).toBe("Lia Sou")
  })

  test("is nothing outside a mention", () => {
    expect(mentionBeingTyped("Oi Lia")).toBeUndefined()
    expect(mentionBeingTyped("ana@li")).toBeUndefined()
  })
})
