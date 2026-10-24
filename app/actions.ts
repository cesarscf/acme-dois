"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { AgentChoice } from "@/lib/agent/cards"
import { type AgentLook, avatarColors, avatarShapes } from "@/lib/agent/look"
import { createAnthropicModel, type Model } from "@/lib/agent/model"
import { actOnCard, markRead, sendMessage } from "@/lib/chat/conversation"
import { requireMember } from "@/lib/dal"
import { findAgent } from "@/lib/organization/agents"

// One client for the server's lifetime; it holds no request state.
let model: Model | undefined

const messageText = z.string().trim().min(1).max(4000)

export async function sendMessageAction(agentId: string, input: string) {
  const member = await requireMember()
  const [agent, text] = [await findAgent(member, agentId), messageText.safeParse(input)]
  if (!agent || !text.success) return
  await sendMessage(member, agent, text.data, { model: (model ??= createAnthropicModel()) })
  // The list beside every conversation shows the reply, even if the member opened another one.
  revalidatePath("/", "layout")
}

// The member saw the conversation up to its message at `upTo`.
export async function markReadAction(agentId: string, upTo: string) {
  const member = await requireMember()
  const [agent, seen] = [await findAgent(member, agentId), z.iso.datetime().safeParse(upTo)]
  if (!agent || !seen.success) return
  await markRead(member, agent, new Date(seen.data))
  revalidatePath("/", "layout")
}

const look = z.object({ shape: z.enum(avatarShapes), color: z.enum(avatarColors) })

const cardChoice = z.object({
  messageId: z.uuid(),
  choice: z.enum(["undo", "accept", "decline", "choose"]),
  look: look.optional(),
  // The name and look settled for each agent of a team proposal.
  team: z.array(look.extend({ name: z.string().trim().min(1).max(40) })).max(5).optional(),
})

export async function actOnCardAction(
  agentId: string,
  messageId: string,
  choice: string,
  settled?: { look?: AgentLook; team?: AgentChoice[] },
) {
  const member = await requireMember()
  const agent = await findAgent(member, agentId)
  const input = cardChoice.safeParse({ messageId, choice, ...settled })
  if (!agent || !input.success) return
  await actOnCard(member, agent, input.data.messageId, input.data.choice, {
    look: input.data.look,
    team: input.data.team,
  })
  // Confirming a team or a look changes the list beside every conversation.
  revalidatePath("/", "layout")
}
