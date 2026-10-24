"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AcmeLogo } from "@/components/acme-logo"
import { type ConversationSummary, useConversations } from "@/components/conversations"
import { CreateMenu } from "@/components/create-menu"
import { ConversationFace, ConversationText } from "@/components/conversation-line"
import { NavUser } from "@/components/nav-user"
import { useShell } from "@/components/shell"
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

// The list beside the chat on a computer. A phone shows the list as its own screen instead (the
// home page), as WhatsApp does, so there is no sheet to open.
export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const { conversations, working } = useConversations()
  const { user, manages, setupId, people, agents } = useShell()

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
          data-bot-hover=""
          tooltip={conversation.name}
          isActive={isActive}
          className="h-auto gap-3 py-2 group-data-[collapsible=icon]:h-auto! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:px-3! group-data-[collapsible=icon]:py-2!"
          render={<Link href={href} prefetch />}
        >
          <ConversationFace conversation={conversation} unread={unread} />
          <ConversationText conversation={conversation} typing={typing} className="group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  if (isMobile) return null

  return (
    // One list of every conversation, with agents and groups alike. Collapsed to icons, each stays as
    // its avatar, named in a tooltip.
    <Sidebar collapsible="icon">
      {/* The logo's circle, the avatars and the + keep their place as the sidebar narrows, as the
          agents' avatars do: lined up on the same middle, 42px from the edge, while the text goes. */}
      <SidebarHeader className="overflow-hidden">
        {/* As wide as the open sidebar, so opening it only uncovers the name and the +, which never
            move, as the chats' text does. */}
        <div className="flex h-10 w-[calc(var(--sidebar-width)-1rem)] shrink-0 items-center gap-2 pr-1 pl-5">
          <AcmeLogo className="min-w-0 flex-1" />
          <div className="group-data-[collapsible=icon]:hidden">
            <CreateMenu
              manages={manages}
              setupId={setupId}
              people={people}
              agents={agents}
              />
          </div>
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
        {/* Collapsed, the + comes down here, as the chats change: at once. */}
        <div className="hidden pl-[18px] group-data-[collapsible=icon]:block">
          <CreateMenu
            manages={manages}
            setupId={setupId}
            people={people}
            agents={agents}
          />
        </div>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
