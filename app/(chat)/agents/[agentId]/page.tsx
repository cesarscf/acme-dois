import { notFound } from "next/navigation"
import { AgentAvatar } from "@/components/agent-avatar"
import { Chat } from "@/components/chat"
import { listMessages } from "@/lib/chat/conversation"
import { requireMember } from "@/lib/dal"
import { findAgent } from "@/lib/organization/agents"

export default async function AgentPage({ params }: PageProps<"/agents/[agentId]">) {
  const [{ agentId }, member] = await Promise.all([params, requireMember()])
  const agent = await findAgent(member, agentId)
  if (!agent) notFound()
  const messages = await listMessages(member, agent)
  return (
    <>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <AgentAvatar look={agent} />
        <div className="min-w-0">
          <h1 className="font-medium">{agent.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{agent.role}</p>
        </div>
      </header>
      <Chat agentId={agent.id} agentName={agent.name} messages={messages} />
    </>
  )
}
