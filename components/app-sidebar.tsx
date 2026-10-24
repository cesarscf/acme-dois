"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AcmeLogo } from "@/components/acme-logo"
import { AgentAvatar } from "@/components/agent-avatar"
import { type ConversationSummary, useConversations } from "@/components/conversations"
import { CreateMenu } from "@/components/create-menu"
import { GroupAvatar } from "@/components/group-avatar"
import { NavUser } from "@/components/nav-user"
import type { GroupCandidates } from "@/components/new-group-form"
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

type Props = GroupCandidates & {
  user: { name: string; email: string }
  manages: boolean
  setupId: string
}

export function AppSidebar({ user, manages, setupId, people, agents }: Props) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const { conversations, working } = useConversations()

  const item = (conversation: ConversationSummary) => {
    const { href } = conversation
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
          className="h-auto gap-3 py-2 group-data-[collapsible=icon]:h-auto! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:px-3! group-data-[collapsible=icon]:py-2!"
          render={<Link href={href} onClick={() => setOpenMobile(false)} />}
        >
          <span className="relative size-10 shrink-0">
            {/* The button sizes every svg in it as an icon. */}
            {conversation.kind === "group" ? (
              <GroupAvatar looks={conversation.looks} className="size-full!" />
            ) : (
              <AgentAvatar look={conversation.looks[0]} size={40} className="size-full!" />
            )}
            {unread ? (
              <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-sidebar">
                <span className="sr-only">Mensagem nova</span>
              </span>
            ) : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
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
    // One list of every conversation, with agents and groups alike. Collapsed to icons, each stays as
    // its avatar, named in a tooltip.
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Collapsed, only the mark stays on top, and the + moves down above Sair. */}
        <div className="hidden justify-center pt-2 pb-1 group-data-[collapsible=icon]:flex">
          <AcmeLogo markOnly />
        </div>
        <div className="flex items-center gap-2 pt-1 pl-3 group-data-[collapsible=icon]:hidden">
          <AcmeLogo className="min-w-0 flex-1" />
          <CreateMenu
            manages={manages}
            setupId={setupId}
            people={people}
            agents={agents}
            onNavigate={() => setOpenMobile(false)}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{conversations.map(item)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <CreateMenu
            manages={manages}
            setupId={setupId}
            people={people}
            agents={agents}
            onNavigate={() => setOpenMobile(false)}
          />
        </div>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
