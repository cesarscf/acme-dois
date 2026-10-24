"use client"

import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import type { AgentLook } from "@/lib/agent/look"

type SidebarAgent = AgentLook & { id: string; kind: "setup" | "team"; name: string; role: string }

type Props = { organizationName: string; memberName: string; agents: SidebarAgent[] }

export function AppSidebar({ organizationName, memberName, agents }: Props) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  const item = (agent: SidebarAgent) => {
    const href = `/agents/${agent.id}`
    return (
      <SidebarMenuItem key={agent.id}>
        <SidebarMenuButton
          size="lg"
          tooltip={agent.name}
          isActive={pathname === href}
          render={<Link href={href} onClick={() => setOpenMobile(false)} />}
        >
          {/* The button sizes every svg in it as an icon. */}
          <AgentAvatar look={agent} size={32} className="size-8!" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{agent.name}</span>
            <span className="truncate text-xs text-muted-foreground">{agent.role}</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    // Collapsed to icons, the agents stay as their avatars, named in a tooltip.
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <p className="truncate px-2 pt-1 text-sm font-medium group-data-[collapsible=icon]:hidden">
          {organizationName}
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{agents.map(item)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit" tooltip="Sair">
                <LogOutIcon />
                <span className="truncate">Sair ({memberName})</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
