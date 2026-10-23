import { signOut } from "@/app/(auth)/actions"
import { AgentNav } from "@/components/agent-nav"
import { Button } from "@/components/ui/button"
import { getOrganizationName, requireMember } from "@/lib/dal"
import { listAgents } from "@/lib/organization/agents"

export default async function ChatLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember()
  const [agents, organizationName] = await Promise.all([
    listAgents(member),
    getOrganizationName(member.organizationId),
  ])
  return (
    <div className="flex h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 pt-3 md:py-3">
          <p className="truncate text-sm font-medium">{organizationName}</p>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
        <AgentNav agents={agents} />
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
