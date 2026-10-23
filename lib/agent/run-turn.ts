import type Anthropic from "@anthropic-ai/sdk"
import type { AgendaAction, Card } from "./cards"
import type { Model } from "./model"
import { systemPrompt } from "./prompt"
import type { ToolContext, ToolRegistry } from "./tools"

type Entry = Anthropic.Beta.BetaMessageParam

// What the member sees from the agent this turn, in order.
export type AgentReply = { text: string } | { card: Card; action?: AgendaAction }

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
  tools,
  transcript,
  context,
}: {
  model: Model
  tools: ToolRegistry
  transcript: Entry[]
  context: ToolContext
}): Promise<Turn> {
  const entries: Entry[] = []
  const replies: AgentReply[] = []

  for (let step = 0; step < maxSteps; step++) {
    const reply = await model({
      system: systemPrompt,
      tools: tools.definitions,
      messages: [...transcript, ...entries],
    })
    entries.push({ role: "assistant", content: reply.content })
    const text = textOf(reply.content)
    if (text) replies.push({ text })

    if (reply.stopReason !== "tool_use") {
      if (reply.stopReason !== "end_turn" || !text) replies.push({ text: unanswered })
      return { entries, replies }
    }

    const calls = reply.content.filter((block) => block.type === "tool_use")
    // One after another: tools change the same agenda, and their cards keep the model's order.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of calls) {
      const { result, card, action } = await tools.execute(call, context)
      results.push(result)
      if (card) replies.push({ card, action })
    }
    entries.push({ role: "user", content: results })
  }

  replies.push({ text: unanswered })
  return { entries, replies }
}
