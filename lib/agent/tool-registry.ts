import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { AgendaError } from "../agenda/appointments"
import type { Member } from "../member"
import { AgentError } from "../organization/agents"
import type { ApprovalCard, Card, CardAction } from "./cards"

export type ToolContext = {
  // Tools read and change the organization's data as the member the turn acts for.
  member: Member
  now: Date
  timeZone: string
  // The tools the agent whose turn it is may use without asking first.
  actsAlone: string[]
  // What a new appointment lasts in this organization, when it said.
  appointmentMinutes: number | null
  // Set when a member confirmed this very call.
  confirmed?: boolean
}

// What a tool hands back: `output` goes to the model; a card, to the member.
export type ToolOutput = { output: unknown; card?: Card; action?: CardAction }

// A tool turning down its input with a reason the model can act on.
export class ToolRefusal extends Error {}

export type Tool<Input extends z.ZodObject = z.ZodObject> = {
  name: string
  // How the setup agent names it to a member.
  label: string
  description: string
  input: Input
  run: (input: z.infer<Input>, context: ToolContext) => Promise<ToolOutput>
  // For a tool that changes data: what a member confirms when the agent may not use it alone.
  confirm?: (
    input: z.infer<Input>,
    context: ToolContext,
  ) => Promise<Pick<ApprovalCard, "title" | "rows">>
}

export const defineTool = <Input extends z.ZodObject>(tool: Tool<Input>) => tool as unknown as Tool

export type ToolCall = { id: string; name: string; input: unknown }
export type Execution = { result: Anthropic.Beta.BetaToolResultBlockParam } & Omit<ToolOutput, "output">

const askedNote =
  "Pedi a confirmação do membro num card. Não diga que já fez: a decisão chega numa próxima mensagem."

export function createToolRegistry(tools: Tool[]) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]))

  const error = (call: ToolCall, content: string): Execution => ({
    result: { type: "tool_result", tool_use_id: call.id, content, is_error: true },
  })
  const result = (call: ToolCall, output: unknown) => ({
    type: "tool_result" as const,
    tool_use_id: call.id,
    content: JSON.stringify(output),
  })

  return {
    // In a fixed order, so the cached prefix stays the same between calls.
    definitions: tools.map((tool): Anthropic.Beta.BetaTool => {
      const schema: Record<string, unknown> = z.toJSONSchema(tool.input)
      delete schema.$schema
      return {
        name: tool.name,
        description: tool.description,
        input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      }
    }),

    // The model's input is checked against the tool's schema before the tool sees it. A change the
    // agent may not make alone is shown for a member to confirm instead of made.
    async execute(call: ToolCall, context: ToolContext): Promise<Execution> {
      const tool = byName.get(call.name)
      if (!tool) return error(call, `Não existe a ferramenta ${call.name}.`)
      const input = tool.input.safeParse(call.input)
      if (!input.success)
        return error(call, `Entrada inválida para ${call.name}: ${z.prettifyError(input.error)}`)
      try {
        if (tool.confirm && !context.confirmed && !context.actsAlone.includes(tool.name)) {
          const asked = await tool.confirm(input.data, context)
          return {
            result: result(call, askedNote),
            card: { type: "approval", ...asked, status: "pending" },
            action: { kind: "apply", tool: tool.name, input: input.data },
          }
        }
        const { output, ...shown } = await tool.run(input.data, context)
        return { result: result(call, output), ...shown }
      } catch (failure) {
        if (
          failure instanceof ToolRefusal ||
          failure instanceof AgendaError ||
          failure instanceof AgentError
        )
          return error(call, failure.message)
        console.error(`Tool ${call.name} failed`, failure)
        return error(call, `A ferramenta ${call.name} falhou.`)
      }
    },
  }
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>
