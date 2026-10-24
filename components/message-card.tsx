"use client"

import { useTransition } from "react"
import { actOnCardAction, actOnGroupCardAction } from "@/app/actions"
import { InviteCard } from "@/components/invite-card"
import { LookCard } from "@/components/look-card"
import { TeamCard } from "@/components/team-card"
import {
  KeyValues,
  MemberBubble,
  QuestionCard,
  SalteCard,
  SystemEvent,
} from "@/components/salte"
import type { ApprovalCard, Card as CardData, ReceiptCard } from "@/lib/agent/cards"

// A card in the member's conversation with an agent, or in a group, where it is for whoever called
// the agent: anyone else (`cardFor` names who it's for) only sees it.
type Props = { messageId: string; card: CardData } & (
  | { agentId: string }
  | { groupId: string; cardFor: string | null }
)

export function MessageCard(props: Props) {
  const { messageId, card } = props
  const [pending, startTransition] = useTransition()
  const act = (choice: "undo" | "accept" | "decline") =>
    startTransition(() =>
      "groupId" in props
        ? actOnGroupCardAction(props.groupId, messageId, choice)
        : actOnCardAction(props.agentId, messageId, choice),
    )
  const cardFor = "groupId" in props ? props.cardFor : null

  // The setup agent's cards: only ever in a member's own conversation with it.
  if (card.type === "look" && "agentId" in props)
    return <LookCard agentId={props.agentId} messageId={messageId} card={card} />
  if (card.type === "team" && "agentId" in props)
    return <TeamCard agentId={props.agentId} messageId={messageId} card={card} />
  if (card.type === "invite") return <InviteCard card={card} />
  if (card.type === "receipt") return <Receipt card={card} pending={pending} cardFor={cardFor} onUndo={() => act("undo")} />
  if (card.type === "approval") return <Approval card={card} pending={pending} cardFor={cardFor} onChoose={act} />
  return null
}

type ReceiptProps = { card: ReceiptCard; pending: boolean; cardFor: string | null; onUndo: () => void }

function Receipt({ card, pending, cardFor, onUndo }: ReceiptProps) {
  // A note to keep reads like Salte's "Sobre você" card; a change, as an event with Undo.
  if (!card.undoable)
    return (
      <SalteCard className="p-3.5">
        <div className="text-[12.5px] text-sub">{card.title}</div>
        <div className="mt-0.5 text-[14.5px] whitespace-pre-wrap text-ink">{card.detail}</div>
      </SalteCard>
    )
  return (
    <SystemEvent>
      <b className="font-semibold text-ink">{card.title}:</b> {card.detail}
      <span className="text-faint"> · </span>
      {card.status === "applied" && cardFor ? (
        <span className="text-faint">pedido de {cardFor}</span>
      ) : card.status === "applied" ? (
        <button type="button" disabled={pending} onClick={onUndo} className="font-semibold text-ink disabled:opacity-50">
          Desfazer
        </button>
      ) : card.status === "undone" ? (
        "Desfeito"
      ) : (
        "a agenda mudou, não deu para desfazer"
      )}
    </SystemEvent>
  )
}

const answers: Partial<Record<ApprovalCard["status"], string>> = {
  accepted: "Confirmar",
  declined: "Agora não",
  stale: "Confirmar",
}

type ApprovalProps = {
  card: ApprovalCard
  pending: boolean
  cardFor: string | null
  onChoose: (choice: "accept" | "decline") => void
}

// Salte asks in two cards: what will happen, then "Confirma?" with lettered answers. Answered, the
// question fades and the answer shows as the member's bubble.
function Approval({ card, pending, cardFor, onChoose }: ApprovalProps) {
  const answered = card.status !== "pending"
  return (
    <>
      <SalteCard className="p-4">
        <KeyValues rows={card.rows} />
      </SalteCard>
      <QuestionCard
        question={card.title}
        answered={answered}
        disabled={pending || Boolean(cardFor)}
        options={[
          { label: "Confirmar", onClick: () => onChoose("accept") },
          { label: "Agora não", onClick: () => onChoose("decline") },
        ]}
      />
      {!answered && cardFor ? <SystemEvent>Só {cardFor} confirma.</SystemEvent> : null}
      {answered && cardFor ? (
        <SystemEvent>
          {cardFor} respondeu: {answers[card.status]}
        </SystemEvent>
      ) : answered ? (
        <MemberBubble>{answers[card.status]}</MemberBubble>
      ) : null}
      {card.status === "stale" ? <SystemEvent>Nada foi feito: algo mudou antes da confirmação.</SystemEvent> : null}
    </>
  )
}
