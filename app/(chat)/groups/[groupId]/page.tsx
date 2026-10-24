import { notFound } from "next/navigation"
import { GroupChat } from "@/components/group-chat"
import { groupLooks } from "@/lib/agent/look"
import { listGroupMessages } from "@/lib/chat/groups"
import { getTeam, requireMember } from "@/lib/dal"
import { findGroup, mayManage, teamAgents } from "@/lib/organization/groups"

export default async function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  const [{ groupId }, member] = await Promise.all([params, requireMember()])
  // The team and its agents don't depend on the group, so they load while it is looked up.
  const others = Promise.all([getTeam(member.organizationId), teamAgents(member.organizationId)])
  // Handled here too, in case the group is missing and nothing waits for them.
  others.catch(() => {})
  const group = await findGroup(member, groupId)
  if (!group) notFound()
  const [messages, [team, agents]] = await Promise.all([listGroupMessages(member, group), others])
  const shown = (agent: (typeof agents)[number]) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    look: { shape: agent.shape, color: agent.color },
  })
  // Its agents, then its people, four at most.
  const looks = groupLooks(
    group.agents.map(({ shape, color }) => ({ shape, color })),
    group.members.map(({ id }) => id),
  )
  const [inPeople, inAgents] = [new Set(group.members.map(({ id }) => id)), new Set(group.agents.map(({ id }) => id))]
  return (
    <GroupChat
      group={{
        id: group.id,
        name: group.name,
        general: group.general,
        members: group.members.map((teammate) => teammate.name),
        looks,
      }}
      agents={group.agents.map(shown)}
      messages={messages}
      profile={{
        id: group.id,
        name: group.name,
        general: group.general,
        canManage: mayManage(member, group),
        looks,
        you: member.id,
        people: group.members.map(({ id, name }) => ({ id, name })),
        agents: group.agents.map(shown),
        outside: {
          people: team.filter(({ id }) => !inPeople.has(id)).map(({ id, name }) => ({ id, name })),
          agents: agents.filter(({ id }) => !inAgents.has(id)).map(shown),
        },
      }}
    />
  )
}
