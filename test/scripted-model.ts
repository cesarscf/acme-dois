import type Anthropic from "@anthropic-ai/sdk"
import type { Model, ModelReply, ModelRequest } from "@/lib/agent/model"

// Stands in for Claude: replies with each scripted reply in turn and records every request.
export function scriptedModel(...replies: ModelReply[]) {
  const requests: ModelRequest[] = []
  const model: Model = async (request) => {
    requests.push(structuredClone(request))
    const reply = replies.shift()
    if (!reply) throw new Error("The script ran out of replies.")
    return reply
  }
  return { model, requests }
}

export const says = (text: string): ModelReply => ({
  content: [{ type: "text", text }],
  stopReason: "end_turn",
})

let calls = 0
export const uses = (...uses: { name: string; input: unknown }[]): ModelReply => ({
  content: uses.map(
    (use): Anthropic.Beta.BetaToolUseBlockParam => ({
      type: "tool_use",
      id: `toolu_${++calls}`,
      ...use,
      input: use.input as Record<string, unknown>,
    }),
  ),
  stopReason: "tool_use",
})
