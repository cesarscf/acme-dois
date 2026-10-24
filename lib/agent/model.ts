import Anthropic from "@anthropic-ai/sdk"

// One model call. run-turn.ts owns the loop around it: tools, transcript, cards.
export type ModelRequest = {
  system: string
  tools: Anthropic.Beta.BetaTool[]
  messages: Anthropic.Beta.BetaMessageParam[]
}

export type ModelReply = {
  // Exactly what goes back into the transcript.
  content: Anthropic.Beta.BetaContentBlockParam[]
  stopReason: Anthropic.Beta.BetaStopReason | null
}

export type Model = (request: ModelRequest) => Promise<ModelReply>

// A fallback that takes over mid-reply leaves the declined model's thinking and tool calls before
// its marker; only text from there may be sent back.
function echoable(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlockParam[] {
  const lastFallback = content.findLastIndex((block) => block.type === "fallback")
  return content.filter(
    (block, index) =>
      index >= lastFallback ||
      !["thinking", "redacted_thinking", "tool_use", "server_tool_use"].includes(block.type),
  ) as Anthropic.Beta.BetaContentBlockParam[]
}

export function createAnthropicModel(client = new Anthropic()): Model {
  return async ({ system, tools, messages }) => {
    const message = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16_000,
      // New turns no longer clear their context, but transcripts from before still carry clear_at,
      // and a transcript is never edited: the API takes it only with this beta.
      betas: ["server-side-fallback-2026-07-01", "mid-conversation-system-clear-at-2026-08-21"],
      // A policy decline is retried on a fallback model inside the same call.
      fallbacks: "default",
      // Chat with the team about the agenda is light work.
      output_config: { effort: "low" },
      // The stable system prompt and tools, then the conversation so far, each up to its breakpoint.
      cache_control: { type: "ephemeral" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    })
    return { content: echoable(message.content), stopReason: message.stop_reason }
  }
}
