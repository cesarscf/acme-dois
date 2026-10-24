import type Anthropic from "@anthropic-ai/sdk"
import type { Card, CardAction } from "./cards"
import type { Model } from "./model"
import type { ToolContext, ToolRegistry } from "./tool-registry"

type Entry = Anthropic.Beta.BetaMessageParam

// What the member sees from the agent this turn: what it wrote, then the cards its tools showed, as
// in Salte ("Fechado. Confere se eu entendi direito:" and the card below it).
export type AgentReply = { text: string } | { card: Card; action?: CardAction }

export type Turn = {
  // What to append to the transcript, after the entries passed in.
  entries: Entry[]
  replies: AgentReply[]
}

// Enough for read → act → answer with a retry or two; past it the model is looping.
const maxSteps = 8

export const unanswered = "Não consegui terminar isso agora. Pode tentar de novo?"

const textOf = (content: Anthropic.Beta.BetaContentBlockParam[]) =>
  content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim()

// One agent turn: the model answers, calling tools until it is done. The transcript is append-only,
// so every request resends the same prefix and reads it from the cache.
export async function runTurn({
  model,
  system,
  tools,
  transcript,
  context,
}: {
  model: Model
  // The agent's stable prompt.
  system: string
  tools: ToolRegistry
  transcript: Entry[]
  context: ToolContext
}): Promise<Turn> {
  const entries: Entry[] = []
  const texts: AgentReply[] = []
  const cards: AgentReply[] = []
  const replies = () => [...texts, ...cards]

  for (let step = 0; step < maxSteps; step++) {
    const reply = await model({
      system,
      tools: tools.definitions,
      messages: [...transcript, ...entries],
    })
    entries.push({ role: "assistant", content: reply.content })
    const text = textOf(reply.content)
    if (text) texts.push({ text })

    if (reply.stopReason !== "tool_use") {
      if (reply.stopReason !== "end_turn" || !text) texts.push({ text: unanswered })
      return { entries, replies: replies() }
    }

    const calls = reply.content.filter((block) => block.type === "tool_use")
    // One after another: tools change the same agenda, and their cards keep the model's order.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of calls) {
      const { result, card, action } = await tools.execute(call, context)
      results.push(result)
      if (card) cards.push({ card, action })
    }
    entries.push({ role: "user", content: results })
  }

  texts.push({ text: unanswered })
  return { entries, replies: replies() }
}
