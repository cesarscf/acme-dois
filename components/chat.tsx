"use client"

import { useOptimistic } from "react"
import { sendMessageAction } from "@/app/actions"
import { MessageCard } from "@/components/message-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ChatMessage } from "@/lib/chat/conversation"
import { cn } from "@/lib/utils"

type Props = { agentId: string; agentName: string; messages: ChatMessage[] }

export function Chat({ agentId, agentName, messages }: Props) {
  const [shown, addSent] = useOptimistic(messages, (state, text: string): ChatMessage[] => [
    ...state,
    { id: `sending-${state.length}`, author: "member", text, card: null, createdAt: new Date() },
  ])
  const waiting = shown.length > messages.length

  async function send(formData: FormData) {
    const text = String(formData.get("text") ?? "").trim()
    if (!text) return
    addSent(text)
    await sendMessageAction(agentId, formData)
  }

  return (
    <>
      {/* Reversed, so the list starts scrolled to the latest message. */}
      <div className="flex flex-1 flex-col-reverse overflow-y-auto">
        <ol className="flex flex-col gap-3 p-4">
          {shown.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Peça para {agentName} algo do trabalho dele, como “Quem eu atendo amanhã?”.
            </li>
          ) : null}
          {shown.map((message) => (
            <li
              key={message.id}
              className={cn("flex", message.author === "member" ? "justify-end" : "justify-start")}
            >
              {message.card ? (
                <MessageCard agentId={agentId} messageId={message.id} card={message.card} />
              ) : (
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    message.author === "member" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {message.text}
                </p>
              )}
            </li>
          ))}
          {waiting ? (
            <li className="text-sm text-muted-foreground" aria-live="polite">
              {agentName} está escrevendo…
            </li>
          ) : null}
        </ol>
      </div>
      <form action={send} className="flex items-end gap-2 border-t p-4">
        <Textarea
          name="text"
          aria-label={`Mensagem para ${agentName}`}
          placeholder={`Escreva para ${agentName}…`}
          rows={1}
          maxLength={4000}
          required
          className="max-h-40 min-h-9 resize-none"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button type="submit" disabled={waiting}>
          Enviar
        </Button>
      </form>
    </>
  )
}
