"use client"

import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { type ConversationSummary, useConversations } from "@/components/conversations"
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

type Props = { organizationName: string; memberName: string }

export function AppSidebar({ organizationName, memberName }: Props) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const { conversations, working } = useConversations()

  const item = (conversation: ConversationSummary) => {
    const href = `/agents/${conversation.id}`
    const isActive = pathname === href
    const typing = working.has(conversation.id)
    // The open conversation is being read, even before the server hears of it.
    const unread = conversation.unread && !isActive
    return (
      <SidebarMenuItem key={conversation.id}>
        <SidebarMenuButton
          size="lg"
          tooltip={conversation.name}
          isActive={isActive}
          className="h-auto gap-3 py-2"
          render={<Link href={href} onClick={() => setOpenMobile(false)} />}
        >
          <span className="relative size-10 shrink-0 group-data-[collapsible=icon]:size-8">
            {/* The button sizes every svg in it as an icon. */}
            <AgentAvatar look={conversation} size={40} className="size-full!" />
            {unread ? (
              <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-sidebar">
                <span className="sr-only">Mensagem nova</span>
              </span>
            ) : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{conversation.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{conversation.when}</span>
            </span>
            {typing ? (
              <span className="salte-shimmer truncate text-[13px]">Digitando...</span>
            ) : (
              <span className="truncate text-[13px] text-muted-foreground">{conversation.preview}</span>
            )}
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
            <SidebarMenu>{conversations.map(item)}</SidebarMenu>
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
