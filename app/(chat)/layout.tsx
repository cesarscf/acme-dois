import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getOrganizationName, requireMember } from "@/lib/dal"
import { listAgents } from "@/lib/organization/agents"

export default async function ChatLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember()
  const [agents, organizationName] = await Promise.all([
    listAgents(member),
    getOrganizationName(member.organizationId),
  ])
  return (
    <SidebarProvider>
      <AppSidebar organizationName={organizationName} memberName={member.name} agents={agents} />
      <SidebarInset className="h-svh">{children}</SidebarInset>
    </SidebarProvider>
  )
}
