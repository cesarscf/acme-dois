"use client"

import { ArrowDownIcon } from "lucide-react"
import { Fragment, type ReactNode, useEffect, useState } from "react"
import { markGroupReadAction, sendGroupMessageAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { useConversations } from "@/components/conversations"
import { GroupAvatar } from "@/components/group-avatar"
import { MessageActions } from "@/components/message-actions"
import { MessageCard } from "@/components/message-card"
import { type Mentionable, PromptForm } from "@/components/prompt-form"
import { MemberBubble, SystemEvent, Thinking } from "@/components/salte"
import { TextPart } from "@/components/text-part"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { GroupChatMessage } from "@/lib/chat/groups"
import { mentionsIn } from "@/lib/chat/mentions"
import { organizationTimeZone } from "@/lib/member"
import { timeIn } from "@/lib/time"

type Props = {
  group: { id: string; name: string; general: boolean; members: string[] }
  agents: Mentionable[]
  messages: GroupChatMessage[]
}

// "@Lia" stands out in what members write, for the agents of the group.
function withMentions(text: string, agents: Mentionable[]): ReactNode {
  if (!agents.length) return text
  const names = agents.map((agent) => agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length)
  return text.split(new RegExp(`(@(?:${names.join("|")}))(?![\\p{L}\\p{N}_])`, "giu")).map((part, index) =>
    index % 2 ? (
      <span key={index} className="font-semibold text-brand">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}

// The group as each member sees it: their own messages on the right, everyone else's on the left
// with their name, and the agents without a bubble. Sending stays out of transitions, as in Chat.
export function GroupChat({ group, agents, messages }: Props) {
  const [sent, setSent] = useState<{ after: GroupChatMessage[]; messages: GroupChatMessage[] }>({
    after: messages,
    messages: [],
  })
  const shown = sent.after === messages ? [...messages, ...sent.messages] : messages
  const { conversations, working, startWorking } = useConversations()
  const [calling, setCalling] = useState<Mentionable | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const answering = working.has(group.id) ? calling : null

  const unread = conversations.some((conversation) => conversation.id === group.id && conversation.unread)
  const lastAt = messages.at(-1)?.createdAt.toISOString()
  useEffect(() => {
    if (unread && lastAt) void markGroupReadAction(group.id, lastAt)
  }, [group.id, unread, lastAt])

  async function send(text: string) {
    setFailed(false)
    setNotice(null)
    const [called] = mentionsIn(text, agents)
    setCalling(called ?? null)
    const done = called ? startWorking(group.id) : () => {}
    const message: GroupChatMessage = {
      id: `sending-${shown.length}`,
      author: "member",
      text,
      card: null,
      createdAt: new Date(),
      mine: true,
      by: { kind: "member", name: "Você" },
      cardFor: null,
    }
    setSent((current) => ({
      after: messages,
      messages: [...(current.after === messages ? current.messages : []), message],
    }))
    try {
      const result = await sendGroupMessageAction(group.id, text)
      if (result.notice) setNotice(result.notice)
    } catch {
      setFailed(true)
    } finally {
      done()
    }
  }

  const who = [
    `${group.members.length} ${group.members.length === 1 ? "pessoa" : "pessoas"}`,
    ...(agents.length ? [agents.map((agent) => agent.name).join(", ")] : []),
  ].join(" · ")

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 lg:px-6">
        <SidebarTrigger className="text-sub" />
        <div className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1">
          <GroupAvatar looks={agents.map((agent) => agent.look)} size={34} ring="bg-surface" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold text-ink">{group.name}</span>
            <span className="block truncate text-[12px] text-faint">
              {answering ? `${answering.name} está respondendo...` : who}
            </span>
          </span>
        </div>
      </header>

      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-6 pt-6 pb-6">
              <SystemEvent>
                {group.general
                  ? "Grupo com toda a equipe e todos os agentes de agenda."
                  : `Grupo com ${group.members.join(", ")}${agents.length ? ` e ${agents.map((agent) => agent.name).join(", ")}` : ""}.`}{" "}
                {agents.length ? "Escreva @ e o nome de um agente para chamá-lo." : ""}
              </SystemEvent>
              {shown.map((message, index) => {
                const previous = shown[index - 1]
                const sameAuthor =
                  previous && previous.by.kind === message.by.kind && previous.by.name === message.by.name
                return (
                  <MessageScrollerItem key={message.id} messageId={message.id} className="flex flex-col">
                    <GroupMessage groupId={group.id} message={message} agents={agents} named={!sameAuthor} />
                  </MessageScrollerItem>
                )
              })}
              {answering ? (
                <MessageScrollerItem messageId="thinking">
                  <Thinking look={answering.look} />
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
        {notice ? <SystemEvent>{notice}</SystemEvent> : null}
        {failed ? <SystemEvent>A mensagem não foi enviada. Confira a sua conexão e tente de novo.</SystemEvent> : null}
        <PromptForm
          placeholder={`Escreva para ${group.name}`}
          isBusy={Boolean(answering)}
          onSubmit={send}
          mentions={agents}
        />
      </div>
    </div>
  )
}

function GroupMessage({
  groupId,
  message,
  agents,
  named,
}: {
  groupId: string
  message: GroupChatMessage
  agents: Mentionable[]
  // The first of a run of messages by the same author shows who wrote them.
  named: boolean
}) {
  const { by } = message
  if (message.mine) return <MemberBubble>{withMentions(message.text ?? "", agents)}</MemberBubble>
  if (by.kind === "member")
    return (
      <div className="flex max-w-[80%] flex-col gap-1 self-start">
        {named ? <span className="px-1 text-[12px] font-semibold text-sub">{by.name}</span> : null}
        <div className="rounded-[20px] bg-surface px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap text-ink">
          {withMentions(message.text ?? "", agents)}
        </div>
      </div>
    )
  return (
    <div className="flex flex-col gap-1.5">
      {named ? (
        <span className="flex items-center gap-2 text-[12px] font-semibold text-sub">
          <AgentAvatar look={by} size={20} />
          {by.name}
        </span>
      ) : null}
      {message.card ? (
        <div className="flex flex-col gap-3">
          <MessageCard groupId={groupId} messageId={message.id} card={message.card} cardFor={message.cardFor} />
        </div>
      ) : (
        <div className="text-ink">
          <TextPart text={message.text ?? ""} />
          <MessageActions text={message.text ?? ""} time={timeIn(message.createdAt, organizationTimeZone)} />
        </div>
      )}
    </div>
  )
}
