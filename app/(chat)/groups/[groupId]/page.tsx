import { notFound } from "next/navigation"
import { GroupChat } from "@/components/group-chat"
import { findGroup, listGroupMessages } from "@/lib/chat/groups"
import { requireMember } from "@/lib/dal"

export default async function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  const [{ groupId }, member] = await Promise.all([params, requireMember()])
  const group = await findGroup(member, groupId)
  if (!group) notFound()
  const messages = await listGroupMessages(member, group)
  return (
    <GroupChat
      group={{ id: group.id, name: group.name, general: group.general, members: group.members.map((teammate) => teammate.name) }}
      agents={group.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        look: { shape: agent.shape, color: agent.color },
      }))}
      messages={messages}
    />
  )
}
