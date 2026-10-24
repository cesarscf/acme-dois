"use client"

import { ArrowDownIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { markReadAction, sendMessageAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { AgentPanel, type AgentProfile } from "@/components/agent-panel"
import { ChatMessage } from "@/components/chat-message"
import { useConversations } from "@/components/conversations"
import { PromptForm } from "@/components/prompt-form"
import { BornDivider, SystemEvent, Thinking } from "@/components/salte"
import { Suggestions } from "@/components/suggestions"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { AgentLook } from "@/lib/agent/look"
import type { ChatMessage as ChatMessageData } from "@/lib/chat/conversation"

type Props = {
  agent: AgentLook & { id: string; name: string; role: string }
  messages: ChatMessageData[]
  suggestions: string[]
  profile: AgentProfile
}

// Sending and reading stay out of transitions: React holds every navigation until a pending
// transition ends, so the member couldn't open another conversation while the agent answers.
export function Chat({ agent, messages, suggestions, profile }: Props) {
  const [showProfile, setShowProfile] = useState(false)
  // What the member sent, until the conversation comes back from the server with it.
  const [sent, setSent] = useState<{ after: ChatMessageData[]; messages: ChatMessageData[] }>({
    after: messages,
    messages: [],
  })
  const shown = sent.after === messages ? [...messages, ...sent.messages] : messages
  const { conversations, working: answering, startWorking } = useConversations()
  // Held above the page, so it's still answering when the member comes back.
  const working = answering.has(agent.id)
  const [failed, setFailed] = useState(false)
  const started = shown.some((message) => message.author === "member")
  const waitingForMember = shown.some((message) => message.card?.status === "pending")
  const status = working ? "Trabalhando..." : waitingForMember ? "Esperando você" : agent.role

  // Whatever the agent wrote is read once it shows here.
  const unread = conversations.some((conversation) => conversation.id === agent.id && conversation.unread)
  const lastAt = messages.at(-1)?.createdAt.toISOString()
  useEffect(() => {
    if (unread && lastAt) void markReadAction(agent.id, lastAt)
  }, [agent.id, unread, lastAt])

  async function send(text: string) {
    setFailed(false)
    const done = startWorking(agent.id)
    const message: ChatMessageData = {
      id: `sending-${shown.length}`,
      author: "member",
      text,
      card: null,
      createdAt: new Date(),
    }
    setSent((current) => ({
      after: messages,
      messages: [...(current.after === messages ? current.messages : []), message],
    }))
    try {
      await sendMessageAction(agent.id, text)
    } catch {
      setFailed(true)
    } finally {
      done()
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 lg:px-6">
          <SidebarTrigger className="text-sub" />
          <button
            type="button"
            onClick={() => setShowProfile((shown) => !shown)}
            aria-expanded={showProfile}
            title={`Sobre ${agent.name}`}
            className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-left hover:bg-soft"
          >
            <span className="relative shrink-0">
              <AgentAvatar look={agent} size={34} />
              {working ? (
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
              ) : null}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold text-ink">{agent.name}</span>
              <span className="block truncate text-[12px] text-faint">{status}</span>
            </span>
          </button>
        </header>

        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-6 pt-6 pb-6">
                <BornDivider look={agent} name={agent.name} />
                {shown.map((message) => (
                  // No scroll anchors: they pin the member's last message to the top and leave room
                  // below it; Salte keeps the conversation at the bottom.
                  <MessageScrollerItem key={message.id} messageId={message.id} className="flex flex-col">
                    <ChatMessage agentId={agent.id} message={message} />
                  </MessageScrollerItem>
                ))}
                {working ? (
                  <MessageScrollerItem messageId="thinking">
                    <Thinking look={agent} />
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton>
              <ArrowDownIcon />
              <span className="sr-only">Ir para a última mensagem</span>
            </MessageScrollerButton>
          </MessageScroller>
        </MessageScrollerProvider>

        <div className="mx-auto flex w-full max-w-[760px] shrink-0 flex-col gap-3 px-4 pb-5 lg:px-6">
          {failed ? <SystemEvent>A mensagem não foi enviada. Confira a sua conexão e tente de novo.</SystemEvent> : null}
          {!started && !working ? <Suggestions suggestions={suggestions} onSelect={send} /> : null}
          <PromptForm placeholder={`Escreva para ${agent.name}`} isBusy={working} onSubmit={send} />
        </div>
      </div>
      {showProfile ? <AgentPanel agent={profile} onClose={() => setShowProfile(false)} /> : null}
    </div>
  )
}
