"use client"

import { useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import {
  AnswerBubble,
  CardTitle,
  cardFrame,
  KeyValues,
  OptionRow,
  Options,
  SystemEvent,
} from "@/components/card-frame"
import { LookCard } from "@/components/look-card"
import type { ApprovalCard, Card as CardData, ReceiptCard } from "@/lib/agent/cards"

type Props = { agentId: string; messageId: string; card: CardData }

export function MessageCard({ agentId, messageId, card }: Props) {
  const [pending, startTransition] = useTransition()
  const act = (choice: "undo" | "accept" | "decline") =>
    startTransition(() => actOnCardAction(agentId, messageId, choice))

  if (card.type === "look") return <LookCard agentId={agentId} messageId={messageId} card={card} />
  if (card.type === "receipt") return <Receipt card={card} pending={pending} onUndo={() => act("undo")} />
  return <Approval card={card} pending={pending} onChoose={act} />
}

const receiptOutcome: Record<ReceiptCard["status"], string | null> = {
  applied: null,
  undone: "Desfeito",
  stale: "A agenda mudou; não deu para desfazer",
}

function Receipt({ card, pending, onUndo }: { card: ReceiptCard; pending: boolean; onUndo: () => void }) {
  // A note to keep, like how the organization works, reads as a card; a change, as an event.
  if (!card.undoable)
    return (
      <div className={cardFrame}>
        <CardTitle>{card.title}</CardTitle>
        <p className="px-3 pb-3 text-sm whitespace-pre-wrap text-muted-foreground">{card.detail}</p>
      </div>
    )
  const outcome = receiptOutcome[card.status]
  return (
    <SystemEvent>
      <span className="font-medium text-foreground">{card.title}:</span> {card.detail}
      {" · "}
      {outcome ? (
        outcome
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={onUndo}
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          Desfazer
        </button>
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
  onChoose: (choice: "accept" | "decline") => void
}

function Approval({ card, pending, onChoose }: ApprovalProps) {
  const rows = card.rows.map((row) => ({
    label: row.look ? (
      <span className="flex items-center gap-1.5">
        <AgentAvatar look={row.look} size={18} />
        {row.label}
      </span>
    ) : (
      row.label
    ),
    value: row.value,
  }))

  if (card.status !== "pending")
    return (
      <>
        <div className={cardFrame}>
          <CardTitle>{card.title}</CardTitle>
          <KeyValues rows={rows} />
        </div>
        <AnswerBubble>{answers[card.status]}</AnswerBubble>
        {card.status === "stale" ? <SystemEvent>Nada foi feito: algo mudou antes da confirmação.</SystemEvent> : null}
      </>
    )

  return (
    <div className={cardFrame}>
      <CardTitle>{card.title}</CardTitle>
      <KeyValues rows={rows} />
      <Options>
        <OptionRow letter="A" label="Confirmar" disabled={pending} onClick={() => onChoose("accept")} />
        <OptionRow letter="B" label="Agora não" disabled={pending} onClick={() => onChoose("decline")} />
      </Options>
    </div>
  )
}
