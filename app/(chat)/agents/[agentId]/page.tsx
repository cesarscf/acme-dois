import { notFound } from "next/navigation"
import { AgentAvatar } from "@/components/agent-avatar"
import { Chat } from "@/components/chat"
import { SidebarTrigger } from "@/components/ui/sidebar"
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
    <>
      <header className="flex items-center gap-3 px-4 py-3">
        <SidebarTrigger />
        <AgentAvatar look={agent} size={32} />
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm font-medium">{agent.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
        </div>
      </header>
      <Chat
        agentId={agent.id}
        agentName={agent.name}
        messages={messages}
        suggestions={suggestionsFor(agent)}
      />
    </>
  )
}
