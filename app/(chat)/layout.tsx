import type { CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ConversationsProvider } from "@/components/conversations"
import { LiveRefresh } from "@/components/live-refresh"
import { ShellProvider } from "@/components/shell"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listConversations } from "@/lib/chat/conversation"
import { listGroupSummaries } from "@/lib/chat/groups"
import { getSession, requireMember } from "@/lib/dal"
import { listTeam } from "@/lib/agenda/team"
import { manages, organizationTimeZone } from "@/lib/member"
import { lastMessageLabel } from "@/lib/time"

export default async function ChatLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember()
  const [conversations, groups, team, session] = await Promise.all([
    listConversations(member),
    listGroupSummaries(member),
    listTeam(member.organizationId),
    getSession(),
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
      <ShellProvider
        shell={{
          user: { name: member.name, email: session?.user.email ?? "" },
          manages: manages(member),
          setupId: setup.id,
          people: team.filter((teammate) => teammate.id !== member.id).map(({ id, name }) => ({ id, name })),
          agents: conversations
            .filter((conversation) => conversation.kind === "team")
            .map(({ id, name, role, shape, color }) => ({ id, name, role, look: { shape, color } })),
        }}
      >
        <LiveRefresh />
        {/* Collapsed, the list keeps each avatar as large and where it was: only the text goes. */}
        <SidebarProvider style={{ "--sidebar-width": "18rem", "--sidebar-width-icon": "5.25rem" } as CSSProperties}>
          <AppSidebar />
          <SidebarInset className="h-svh">{children}</SidebarInset>
        </SidebarProvider>
      </ShellProvider>
    </ConversationsProvider>
  )
}
