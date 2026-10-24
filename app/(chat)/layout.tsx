import { AppSidebar } from "@/components/app-sidebar"
import { ConversationsProvider } from "@/components/conversations"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listConversations } from "@/lib/chat/conversation"
import { getOrganizationName, requireMember } from "@/lib/dal"
import { organizationTimeZone } from "@/lib/member"
import { lastMessageLabel } from "@/lib/time"

export default async function ChatLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember()
  const [conversations, organizationName] = await Promise.all([
    listConversations(member),
    getOrganizationName(member.organizationId),
  ])
  const now = new Date()
  return (
    <ConversationsProvider
      conversations={conversations.map(({ id, name, shape, color, preview, lastAt, unread }) => ({
        id,
        name,
        shape,
        color,
        preview,
        when: lastMessageLabel(lastAt, now, organizationTimeZone),
        unread,
      }))}
    >
      <SidebarProvider>
        <AppSidebar organizationName={organizationName} memberName={member.name} />
        <SidebarInset className="h-svh">{children}</SidebarInset>
      </SidebarProvider>
    </ConversationsProvider>
  )
}
