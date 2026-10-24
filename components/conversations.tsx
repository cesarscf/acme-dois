"use client"

import { createContext, type ReactNode, use, useState } from "react"
import type { AgentLook } from "@/lib/agent/look"

export type ConversationSummary = AgentLook & {
  id: string
  name: string
  preview: string
  // "14:05", "Ontem", "Segunda"...
  when: string
  unread: boolean
}

type Conversations = {
  conversations: ConversationSummary[]
  // The agents answering the member right now, so the list shows them typing.
  working: ReadonlySet<string>
  // Marks the agent as working until the returned function is called.
  startWorking: (agentId: string) => () => void
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
  const change = (agentId: string, by: number) =>
    setWorking((current) => {
      const next = new Map(current)
      const count = (next.get(agentId) ?? 0) + by
      if (count > 0) next.set(agentId, count)
      else next.delete(agentId)
      return next
    })

  const startWorking = (agentId: string) => {
    change(agentId, 1)
    let done = false
    return () => {
      if (done) return
      done = true
      change(agentId, -1)
    }
  }

  return (
    <ConversationsContext value={{ conversations, working: new Set(working.keys()), startWorking }}>
      {children}
    </ConversationsContext>
  )
}

export function useConversations() {
  const context = use(ConversationsContext)
  if (!context) throw new Error("useConversations must be used inside ConversationsProvider")
  return context
}
