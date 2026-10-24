"use client"

import { ArrowDownIcon } from "lucide-react"
import { useOptimistic, useState, useTransition } from "react"
import { sendMessageAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { ChatMessage } from "@/components/chat-message"
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
}

export function Chat({ agent, messages, suggestions }: Props) {
  const [shown, addSent] = useOptimistic(messages, (state, text: string): ChatMessageData[] => [
    ...state,
    { id: `sending-${state.length}`, author: "member", text, card: null, createdAt: new Date() },
  ])
  const [working, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const started = shown.some((message) => message.author === "member")
  const waitingForMember = shown.some((message) => message.card?.status === "pending")
  const status = working ? "Trabalhando..." : waitingForMember ? "Esperando você" : agent.role

  function send(text: string) {
    setFailed(false)
    startTransition(async () => {
      addSent(text)
      try {
        await sendMessageAction(agent.id, text)
      } catch {
        setFailed(true)
      }
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 lg:px-6">
        <SidebarTrigger className="text-sub" />
        <div className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1">
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
        </div>
      </header>

      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-6 pt-6 pb-6">
              <BornDivider look={agent} name={agent.name} />
              {shown.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.author === "member"}
                  className="flex flex-col"
                >
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
  )
}
