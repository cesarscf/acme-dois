"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { AgentChoice } from "@/lib/agent/cards"
import { type AgentLook, avatarColors, avatarShapes } from "@/lib/agent/look"
import { createAnthropicModel, type Model } from "@/lib/agent/model"
import { actOnCard, askForNewAgent, markRead, sendMessage } from "@/lib/chat/conversation"
import { actOnGroupCard, createGroup, findGroup, GroupError, markGroupRead, sendGroupMessage } from "@/lib/chat/groups"
import { requireMember } from "@/lib/dal"
import { AgentError, findAgent, newAgentProblem, updateAgentLook, updateAgentProfile } from "@/lib/organization/agents"

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

// The member writes in a group; an agent called with @ answers before this returns. Says why
// nobody will, when the member called an agent outside the group.
export async function sendGroupMessageAction(groupId: string, input: string): Promise<{ notice?: string }> {
  const member = await requireMember()
  const [group, text] = [await findGroup(member, groupId), messageText.safeParse(input)]
  if (!group || !text.success) return {}
  const sent = await sendGroupMessage(member, group, text.data, { model: (model ??= createAnthropicModel()) })
  revalidatePath("/", "layout")
  return sent
}

export async function markGroupReadAction(groupId: string, upTo: string) {
  const member = await requireMember()
  const [group, seen] = [await findGroup(member, groupId), z.iso.datetime().safeParse(upTo)]
  if (!group || !seen.success) return
  await markGroupRead(member, group, new Date(seen.data))
  revalidatePath("/", "layout")
}

const groupCardChoice = z.object({ messageId: z.uuid(), choice: z.enum(["undo", "accept", "decline"]) })

export async function actOnGroupCardAction(groupId: string, messageId: string, choice: string) {
  const member = await requireMember()
  const group = await findGroup(member, groupId)
  const input = groupCardChoice.safeParse({ messageId, choice })
  if (!group || !input.success) return
  await actOnGroupCard(member, group, input.data.messageId, input.data.choice)
  revalidatePath("/", "layout")
}

export type NewGroupState = { error?: string; id?: string } | undefined

export async function createGroupAction(_: NewGroupState, formData: FormData): Promise<NewGroupState> {
  const member = await requireMember()
  const ids = (key: string) => formData.getAll(key).filter((value): value is string => typeof value === "string")
  let created
  try {
    created = await createGroup(member, {
      name: String(formData.get("name") ?? ""),
      memberIds: ids("memberId"),
      agentIds: ids("agentId"),
    })
  } catch (failure) {
    if (failure instanceof GroupError) return { error: failure.message }
    throw failure
  }
  revalidatePath("/", "layout")
  return { id: created.id }
}

const newAgentName = z.string().trim().max(80)

// Checks the name before the dialog closes, so the member can fix it there.
export async function checkNewAgentAction(name: string): Promise<{ error?: string }> {
  const member = await requireMember()
  const parsed = newAgentName.safeParse(name)
  const problem = await newAgentProblem(member, parsed.success ? parsed.data.replace(/\s+/g, " ") : "")
  return problem ? { error: problem } : {}
}

// Asks the setup agent for the new agent, in the member's conversation with it.
export async function askForNewAgentAction(name: string, chosen: AgentLook): Promise<{ error?: string }> {
  const member = await requireMember()
  const input = z.object({ name: newAgentName, look }).safeParse({ name, look: chosen })
  if (!input.success) return { error: "Escolha um nome, uma forma e uma cor." }
  try {
    await askForNewAgent(member, input.data, { model: (model ??= createAnthropicModel()) })
  } catch (failure) {
    if (failure instanceof AgentError) return { error: failure.message }
    throw failure
  }
  revalidatePath("/", "layout")
  return {}
}

// Who runs the organization renames an agent or changes its role, from its panel.
export async function updateAgentProfileAction(
  agentId: string,
  change: { name?: string; role?: string },
): Promise<{ error?: string }> {
  const member = await requireMember()
  const input = z.object({ name: z.string().max(80).optional(), role: z.string().max(120).optional() }).safeParse(change)
  if (!input.success) return { error: "Não deu para salvar." }
  try {
    await updateAgentProfile(member, agentId, input.data)
  } catch (failure) {
    if (failure instanceof AgentError) return { error: failure.message }
    throw failure
  }
  revalidatePath("/", "layout")
  return {}
}

export async function updateAgentLookAction(agentId: string, chosen: AgentLook) {
  const member = await requireMember()
  const input = look.safeParse(chosen)
  if (!input.success) return
  await updateAgentLook(member, agentId, input.data)
  revalidatePath("/", "layout")
}
