"use client"

import { MessageCircleIcon } from "lucide-react"
import Link from "next/link"
import { ConversationFace, ConversationText } from "@/components/conversation-line"
import { useConversations } from "@/components/conversations"
import { CreateMenu } from "@/components/create-menu"
import { UserMenu } from "@/components/nav-user"
import { useShell } from "@/components/shell"

// The home page. On a phone it is the list of conversations, filling the screen as WhatsApp's
// does: open one, and its back arrow comes here. On a computer the list is beside it, so it only
// asks the member to pick a conversation.
export function ConversationHome() {
  const { conversations, working } = useConversations()
  const { user, manages, setupId, people, agents } = useShell()

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-surface md:hidden">
        {/* No bar, as the example: who is signed in and a greeting on the left, the + on the right. */}
        <div className="flex shrink-0 items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2">
          <UserMenu user={user} />
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold text-ink">
            Olá, {user.name.trim().split(/\s+/)[0]}
          </h1>
          <CreateMenu phone manages={manages} setupId={setupId} people={people} agents={agents} />
        </div>
        <nav aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <ul className="flex flex-col p-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={conversation.href}
                  data-bot-hover=""
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 active:bg-soft"
                >
                  <ConversationFace conversation={conversation} unread={conversation.unread} />
                  <ConversationText conversation={conversation} typing={working.has(conversation.id)} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="hidden min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-canvas px-6 text-center md:flex">
        <span className="grid size-14 place-items-center rounded-full bg-soft text-sub">
          <MessageCircleIcon className="size-6" />
        </span>
        <p className="text-[17px] font-semibold text-ink">Escolha uma conversa</p>
        <p className="max-w-sm text-[14px] text-sub">
          Fale com um agente ou com um grupo na lista ao lado, ou crie um novo pelo +.
        </p>
      </div>
    </>
  )
}
