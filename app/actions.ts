"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createAnthropicModel, type Model } from "@/lib/agent/model"
import { actOnCard, sendMessage } from "@/lib/chat/conversation"
import { requireMember } from "@/lib/dal"
import { findAgent } from "@/lib/organization/agents"

// One client for the server's lifetime; it holds no request state.
let model: Model | undefined

const messageText = z.string().trim().min(1).max(4000)

export async function sendMessageAction(agentId: string, formData: FormData) {
  const member = await requireMember()
  const [agent, text] = [await findAgent(member, agentId), messageText.safeParse(formData.get("text"))]
  if (!agent || !text.success) return
  await sendMessage(member, agent, text.data, { model: (model ??= createAnthropicModel()) })
  revalidatePath(`/agents/${agent.id}`)
}

const cardChoice = z.object({
  messageId: z.uuid(),
  choice: z.enum(["undo", "accept", "decline"]),
})

export async function actOnCardAction(agentId: string, messageId: string, choice: string) {
  const member = await requireMember()
  const agent = await findAgent(member, agentId)
  const input = cardChoice.safeParse({ messageId, choice })
  if (!agent || !input.success) return
  await actOnCard(member, agent, input.data.messageId, input.data.choice)
  // Confirming a team proposal adds agents to the list beside every conversation.
  revalidatePath("/", "layout")
}
