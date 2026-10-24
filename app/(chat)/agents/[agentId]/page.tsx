import { notFound } from "next/navigation"
import { Chat } from "@/components/chat"
import { agendaTools, cancelAppointmentTool } from "@/lib/agent/agenda-tools"
import { suggestionsFor } from "@/lib/agent/suggestions"
import { listMessages } from "@/lib/chat/conversation"
import { requireMember } from "@/lib/dal"
import { manages } from "@/lib/member"
import { findAgent } from "@/lib/organization/agents"
import { listAgentGroups } from "@/lib/organization/groups"

export default async function AgentPage({ params }: PageProps<"/agents/[agentId]">) {
  const [{ agentId }, member] = await Promise.all([params, requireMember()])
  const agent = await findAgent(member, agentId)
  if (!agent) notFound()
  const [messages, groups] = await Promise.all([listMessages(member, agent), listAgentGroups(member, agent)])

  // The charter as the panel lists it: what the agent may use, does alone and asks first.
  const labels = (names: string[]) => agendaTools.filter((tool) => names.includes(tool.name)).map((tool) => tool.label)
  const asks = agendaTools.filter(
    (tool) =>
      agent.tools.includes(tool.name) &&
      (tool.confirm || tool.name === cancelAppointmentTool.name) &&
      !agent.actsAlone.includes(tool.name),
  )
  const charter = [
    { label: "Pode usar", items: labels(agent.tools) },
    { label: "Faz sem perguntar", items: labels(agent.actsAlone) },
    { label: "Pergunta antes", items: asks.map((tool) => tool.label) },
  ].filter((section) => section.items.length)

  return (
    <Chat
      agent={{ id: agent.id, name: agent.name, role: agent.role, shape: agent.shape, color: agent.color }}
      messages={messages}
      suggestions={suggestionsFor(agent, member)}
      profile={{
        id: agent.id,
        kind: agent.kind,
        name: agent.name,
        role: agent.role,
        look: { shape: agent.shape, color: agent.color },
        canEditLook: manages(member),
        canEditProfile: manages(member) && agent.kind === "team",
        charter: agent.kind === "team" ? charter : null,
        instructions: agent.kind === "team" ? agent.instructions : null,
        groups: groups.map(({ id, name, looks }) => ({ id, name, looks })),
      }}
    />
  )
}
