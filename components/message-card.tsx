"use client"

import { useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { LookCard } from "@/components/look-card"
import {
  CharterHead,
  KeyValues,
  MemberBubble,
  QuestionCard,
  SalteCard,
  SystemEvent,
} from "@/components/salte"
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

function Receipt({ card, pending, onUndo }: { card: ReceiptCard; pending: boolean; onUndo: () => void }) {
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
      {card.status === "applied" ? (
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
  onChoose: (choice: "accept" | "decline") => void
}

// Salte asks in two cards: what will happen, then "Confirma?" with lettered answers. Answered, the
// question fades and the answer shows as the member's bubble.
function Approval({ card, pending, onChoose }: ApprovalProps) {
  const charters = card.rows.filter((row) => row.look)
  const plain = card.rows.filter((row) => !row.look)
  const answered = card.status !== "pending"
  return (
    <>
      {charters.map((row) => (
        <SalteCard key={row.label} className="p-4">
          <CharterHead look={row.look!} title={`Ficha de ${row.label}`} subtitle={row.value} />
          {row.details?.length ? (
            <KeyValues
              className="mt-3.5"
              rows={row.details.map((detail) => ({
                label: detail.label,
                value: <span className="line-clamp-4">{detail.value}</span>,
              }))}
            />
          ) : null}
        </SalteCard>
      ))}
      {plain.length ? (
        <SalteCard className="p-4">
          <KeyValues rows={plain} />
        </SalteCard>
      ) : null}
      <QuestionCard
        question={card.title}
        answered={answered}
        disabled={pending}
        options={[
          { label: "Confirmar", onClick: () => onChoose("accept") },
          { label: "Agora não", onClick: () => onChoose("decline") },
        ]}
      />
      {answered ? <MemberBubble>{answers[card.status]}</MemberBubble> : null}
      {card.status === "stale" ? <SystemEvent>Nada foi feito: algo mudou antes da confirmação.</SystemEvent> : null}
    </>
  )
}
