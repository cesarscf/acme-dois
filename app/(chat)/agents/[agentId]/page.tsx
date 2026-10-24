import { notFound } from "next/navigation"
import { Chat } from "@/components/chat"
import { suggestionsFor } from "@/lib/agent/suggestions"
import { listMessages } from "@/lib/chat/conversation"
import { requireMember } from "@/lib/dal"
import { findAgent } from "@/lib/organization/agents"

export default async function AgentPage({ params }: PageProps<"/agents/[agentId]">) {
  const [{ agentId }, member] = await Promise.all([params, requireMember()])
  const agent = await findAgent(member, agentId)
  if (!agent) notFound()
  const messages = await listMessages(member, agent)
  return (
    <Chat
      agent={{ id: agent.id, name: agent.name, role: agent.role, shape: agent.shape, color: agent.color }}
      messages={messages}
      suggestions={suggestionsFor(agent)}
    />
  )
}
