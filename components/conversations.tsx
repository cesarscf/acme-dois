"use client"

import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react"
import type { AgentLook } from "@/lib/agent/look"

// A conversation in the list beside the chat: with one agent, or a group.
export type ConversationSummary = {
  id: string
  kind: "agent" | "group"
  href: string
  name: string
  // An agent's look or, for a group, those of its agents.
  looks: AgentLook[]
  preview: string
  // "14:05", "Ontem", "Segunda"...
  when: string
  unread: boolean
}

type Conversations = {
  conversations: ConversationSummary[]
  // The conversations where an agent is answering the member right now, so the list shows it typing.
  working: ReadonlySet<string>
  // Marks the conversation's agent as working until the returned function is called.
  startWorking: (conversationId: string) => () => void
}

const ConversationsContext = createContext<Conversations | null>(null)

// Held above the pages, so an agent still shows as working after the member opens another
// conversation, and again when they come back.
export function ConversationsProvider({
  conversations,
  children,
}: {
  conversations: ConversationSummary[]
  children: ReactNode
}) {
  const [working, setWorking] = useState<ReadonlyMap<string, number>>(new Map())

  // Counted, since the member can write again before the agent answers.
  const change = useCallback((agentId: string, by: number) =>
    setWorking((current) => {
      const next = new Map(current)
      const count = (next.get(agentId) ?? 0) + by
      if (count > 0) next.set(agentId, count)
      else next.delete(agentId)
      return next
    }), [])

  const startWorking = useCallback(
    (agentId: string) => {
      change(agentId, 1)
      let done = false
      return () => {
        if (done) return
        done = true
        change(agentId, -1)
      }
    },
    [change],
  )

  const value = useMemo(
    () => ({ conversations, working: new Set(working.keys()), startWorking }),
    [conversations, working, startWorking],
  )

  return (
    <ConversationsContext value={value}>
      {children}
    </ConversationsContext>
  )
}

export function useConversations() {
  const context = use(ConversationsContext)
  if (!context) throw new Error("useConversations must be used inside ConversationsProvider")
  return context
}
