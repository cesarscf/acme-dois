"use client"

import { ArrowDownIcon, LoaderCircleIcon } from "lucide-react"
import { useOptimistic, useState, useTransition } from "react"
import { sendMessageAction } from "@/app/actions"
import { ChatMessage } from "@/components/chat-message"
import { PromptForm } from "@/components/prompt-form"
import { Suggestions } from "@/components/suggestions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import type { ChatMessage as ChatMessageData } from "@/lib/chat/conversation"

type Props = {
  agentId: string
  agentName: string
  messages: ChatMessageData[]
  suggestions: string[]
}

export function Chat({ agentId, agentName, messages, suggestions }: Props) {
  const [shown, addSent] = useOptimistic(messages, (state, text: string): ChatMessageData[] => [
    ...state,
    { id: `sending-${state.length}`, author: "member", text, card: null, createdAt: new Date() },
  ])
  const [waiting, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const started = shown.some((message) => message.author === "member")

  function send(text: string) {
    setFailed(false)
    startTransition(async () => {
      addSent(text)
      try {
        await sendMessageAction(agentId, text)
      } catch {
        setFailed(true)
      }
    })
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-6">
              {shown.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.author === "member"}
                >
                  <ChatMessage agentId={agentId} message={message} />
                </MessageScrollerItem>
              ))}
              {waiting ? (
                <MessageScrollerItem messageId="thinking">
                  <Message>
                    <MessageContent>
                      <Trace>
                        <TraceLine status="running">
                          <TraceIcon>
                            <LoaderCircleIcon className="animate-spin" />
                          </TraceIcon>
                          <TraceTitle>{agentName} está pensando</TraceTitle>
                        </TraceLine>
                      </Trace>
                    </MessageContent>
                  </Message>
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-6 pb-6">
        {failed ? (
          <Alert variant="destructive">
            <AlertTitle>A mensagem não foi enviada</AlertTitle>
            <AlertDescription>Confira a sua conexão e tente de novo.</AlertDescription>
          </Alert>
        ) : null}
        {!started && !waiting ? <Suggestions suggestions={suggestions} onSelect={send} /> : null}
        <PromptForm placeholder={`Mensagem para ${agentName}…`} isBusy={waiting} onSubmit={send} />
      </div>
    </div>
  )
}
