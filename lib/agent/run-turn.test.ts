import { describe, expect, test } from "bun:test"
import { scriptedModel, says, uses } from "@/test/scripted-model"
import { runTurn, unanswered } from "./run-turn"
import { createToolRegistry, type ToolContext } from "./tool-registry"
import { z } from "zod"

const context: ToolContext = {
  member: { id: "m1", organizationId: "o1", userId: "u1", name: "Ana" },
  now: new Date("2026-10-23T12:00:00Z"),
  timeZone: "America/Sao_Paulo",
  actsAlone: [],
  appointmentMinutes: null,
}

const system = "Você é um agente de teste."

// Tools that touch nothing, so the loop is tested on its own.
const executed: string[] = []
const tools = createToolRegistry([
  {
    name: "echo",
    label: "Ecoar",
    description: "Echo",
    input: z.object({ word: z.string() }),
    run: async ({ word }: { word: string }) => {
      executed.push(word)
      return {
        output: { echoed: word },
        card: { type: "receipt", title: word, detail: "", status: "applied", undoable: true },
        action: { kind: "undo", restores: [] },
      }
    },
  } as never,
])

const transcript = [{ role: "user" as const, content: "Oi" }]

describe("runTurn", () => {
  test("ends with the model's answer", async () => {
    const { model } = scriptedModel(says("Oi, Ana!"))
    const turn = await runTurn({ model, system, tools, transcript, context })
    expect(turn.replies).toEqual([{ text: "Oi, Ana!" }])
    expect(turn.entries).toEqual([{ role: "assistant", content: [{ type: "text", text: "Oi, Ana!" }] }])
  })

  test("runs the tools asked for and sends every result back in one message", async () => {
    const { model, requests } = scriptedModel(
      uses({ name: "echo", input: { word: "a" } }, { name: "echo", input: { word: "b" } }),
      says("Feito."),
    )
    const turn = await runTurn({ model, system, tools, transcript, context })

    // What the agent wrote comes first, then the cards, in the order its tools showed them.
    expect(turn.replies).toEqual([
      { text: "Feito." },
      { card: { type: "receipt", title: "a", detail: "", status: "applied", undoable: true }, action: { kind: "undo", restores: [] } },
      { card: { type: "receipt", title: "b", detail: "", status: "applied", undoable: true }, action: { kind: "undo", restores: [] } },
    ])
    const results = requests[1].messages.at(-1)
    expect(results?.role).toBe("user")
    expect((results?.content as { content: string }[]).map((result) => result.content)).toEqual([
      '{"echoed":"a"}',
      '{"echoed":"b"}',
    ])
  })

  test("keeps the transcript append-only, so each request extends the last one", async () => {
    const { model, requests } = scriptedModel(uses({ name: "echo", input: { word: "a" } }), says("Feito."))
    const turn = await runTurn({ model, system, tools, transcript, context })
    expect(requests[1].messages.slice(0, requests[0].messages.length)).toEqual(requests[0].messages)
    expect(requests.map((request) => request.system)).toEqual([system, system])
    expect([...transcript, ...turn.entries]).toEqual([...requests[1].messages, turn.entries.at(-1)!])
  })

  test("reports a bad tool input to the model instead of running the tool", async () => {
    executed.length = 0
    const { model, requests } = scriptedModel(uses({ name: "echo", input: { word: 3 } }), says("Ops."))
    const turn = await runTurn({ model, system, tools, transcript, context })
    expect(executed).toEqual([])
    expect(turn.replies).toEqual([{ text: "Ops." }])
    expect(requests[1].messages.at(-1)?.content).toMatchObject([{ is_error: true }])
  })

  test("tells the member when the model stopped short", async () => {
    const { model } = scriptedModel({ content: [], stopReason: "refusal" })
    const turn = await runTurn({ model, system, tools, transcript, context })
    expect(turn.replies).toEqual([{ text: unanswered }])
  })

  test("gives up after too many steps", async () => {
    const { model, requests } = scriptedModel(
      ...Array.from({ length: 8 }, () => uses({ name: "echo", input: { word: "de novo" } })),
    )
    const turn = await runTurn({ model, system, tools, transcript, context })
    expect(requests).toHaveLength(8)
    expect(turn.replies[0]).toEqual({ text: unanswered })
    expect(turn.replies.slice(1).every((reply) => "card" in reply)).toBe(true)
  })
})
