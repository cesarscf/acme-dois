"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createAnthropicModel, type Model } from "@/lib/agent/model"
import { actOnCard, sendMessage } from "@/lib/chat/conversation"
import { requireMember } from "@/lib/dal"

// One client for the server's lifetime; it holds no request state.
let model: Model | undefined

const messageText = z.string().trim().min(1).max(4000)

export async function sendMessageAction(formData: FormData) {
  const member = await requireMember()
  const text = messageText.safeParse(formData.get("text"))
  if (!text.success) return
  await sendMessage(member, text.data, { model: (model ??= createAnthropicModel()) })
  revalidatePath("/")
}

const cardChoice = z.object({
  messageId: z.uuid(),
  choice: z.enum(["undo", "accept", "decline"]),
})

export async function actOnCardAction(messageId: string, choice: string) {
  const member = await requireMember()
  const input = cardChoice.safeParse({ messageId, choice })
  if (!input.success) return
  await actOnCard(member, input.data.messageId, input.data.choice)
  revalidatePath("/")
}
