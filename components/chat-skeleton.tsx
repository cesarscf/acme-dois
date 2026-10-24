"use client"

import { usePathname } from "next/navigation"
import { AgentAvatar } from "@/components/agent-avatar"
import { BackToList } from "@/components/back-to-list"
import { useConversations } from "@/components/conversations"
import { GroupAvatar } from "@/components/group-avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"

// What a conversation shows the moment the member opens it, as WhatsApp does: its name and mascot
// at the top, from the list they tapped, and the composer at the bottom. The messages come in a
// moment later, with no gray placeholders in their place.
export function ChatSkeleton() {
  const pathname = usePathname()
  const { conversations } = useConversations()
  const conversation = conversations.find(({ href }) => href === pathname)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas" aria-busy="true">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 lg:px-6">
        <BackToList />
        <SidebarTrigger className="hidden text-sub md:inline-flex" />
        {conversation ? (
          <span className="flex min-w-0 items-center gap-2.5 py-1 pr-4 pl-1">
            {conversation.kind === "group" ? (
              <GroupAvatar looks={conversation.looks} size={34} />
            ) : conversation.looks[0] ? (
              <AgentAvatar look={conversation.looks[0]} size={34} />
            ) : null}
            <span className="truncate text-[15px] font-semibold text-ink">{conversation.name}</span>
          </span>
        ) : null}
      </header>
      <div className="flex-1" />
      <div className="mx-auto w-full max-w-[760px] shrink-0 px-4 pb-5 lg:px-6">
        <div className="flex h-[92px] w-full rounded-[22px] border border-line/70 bg-surface px-3.5 pt-3 text-[15px] text-faint shadow-[0_2px_16px_rgba(0,0,0,.06)]">
          {conversation ? `Escreva para ${conversation.name}` : null}
        </div>
      </div>
    </div>
  )
}
