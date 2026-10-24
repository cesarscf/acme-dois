import { AppSidebar } from "@/components/app-sidebar"
import { ConversationsProvider } from "@/components/conversations"
import { LiveRefresh } from "@/components/live-refresh"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listConversations } from "@/lib/chat/conversation"
import { listGroupSummaries } from "@/lib/chat/groups"
import { getOrganizationName, requireMember } from "@/lib/dal"
import { listTeam } from "@/lib/agenda/team"
import { manages, organizationTimeZone } from "@/lib/member"
import { lastMessageLabel } from "@/lib/time"

export default async function ChatLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember()
  const [conversations, groups, organizationName, team] = await Promise.all([
    listConversations(member),
    listGroupSummaries(member),
    getOrganizationName(member.organizationId),
    listTeam(member.organizationId),
  ])
  const setup = conversations.find((conversation) => conversation.kind === "setup")!
  const now = new Date()
  const when = (at: Date) => lastMessageLabel(at, now, organizationTimeZone)
  return (
    <ConversationsProvider
      conversations={[
        ...conversations.map(({ id, name, shape, color, preview, lastAt, unread }) => ({
          id,
          kind: "agent" as const,
          href: `/agents/${id}`,
          name,
          looks: [{ shape, color }],
          preview,
          lastAt,
          unread,
        })),
        ...groups.map(({ id, name, looks, preview, lastAt, unread }) => ({
          id,
          kind: "group" as const,
          href: `/groups/${id}`,
          name,
          looks,
          preview,
          lastAt,
          unread,
        })),
      ]
        // Agents and groups alike, the conversation that moved last first.
        .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
        .map(({ lastAt, ...conversation }) => ({ ...conversation, when: when(lastAt) }))}
    >
      <LiveRefresh />
      <SidebarProvider>
        <AppSidebar
          organizationName={organizationName}
          memberName={member.name}
          manages={manages(member)}
          setupId={setup.id}
          people={team.filter((teammate) => teammate.id !== member.id).map(({ id, name }) => ({ id, name }))}
          agents={conversations
            .filter((conversation) => conversation.kind === "team")
            .map(({ id, name, role, shape, color }) => ({ id, name, role, look: { shape, color } }))}
        />
        <SidebarInset className="h-svh">{children}</SidebarInset>
      </SidebarProvider>
    </ConversationsProvider>
  )
}
