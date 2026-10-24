"use client"

import { CircleAlertIcon, CircleCheckIcon, CircleSlashIcon, Undo2Icon } from "lucide-react"
import { useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { cardFrame } from "@/components/card-frame"
import { LookCard } from "@/components/look-card"
import { Button } from "@/components/ui/button"
import type { ApprovalCard, Card as CardData, ReceiptCard } from "@/lib/agent/cards"
import { cn } from "@/lib/utils"


const statusLabel: Record<CardData["status"], string> = {
  applied: "Feito",
  undone: "Desfeito",
  pending: "Aguardando você",
  accepted: "Confirmado",
  declined: "Recusado",
  stale: "Nada foi feito",
  chosen: "Escolhida",
}

function StatusIcon({ status }: { status: CardData["status"] }) {
  if (status === "stale") return <CircleAlertIcon className="size-4 text-destructive" />
  if (status === "undone") return <Undo2Icon className="size-4 text-muted-foreground" />
  if (status === "declined") return <CircleSlashIcon className="size-4 text-muted-foreground" />
  return <CircleCheckIcon className="size-4 text-muted-foreground" />
}

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
  const done = card.status !== "applied"
  return (
    <div className={cn(cardFrame, "flex items-start gap-2.5 px-3 py-2.5")}>
      <span className="mt-0.5 shrink-0">
        <StatusIcon status={card.status} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {card.title}
          {done ? <span className="font-normal text-muted-foreground"> · {statusLabel[card.status]}</span> : null}
        </p>
        <p className={cn("text-xs whitespace-pre-wrap text-muted-foreground", done && "line-through")}>
          {card.detail}
        </p>
      </div>
      {card.undoable && !done ? (
        <Button variant="ghost" size="xs" disabled={pending} onClick={onUndo}>
          Desfazer
        </Button>
      ) : null}
    </div>
  )
}

type ApprovalProps = {
  card: ApprovalCard
  pending: boolean
  onChoose: (choice: "accept" | "decline") => void
}

function Approval({ card, pending, onChoose }: ApprovalProps) {
  const open = card.status === "pending"
  return (
    <div className={cn(cardFrame, "flex flex-col gap-2.5 p-3")}>
      <div className="flex items-center gap-2">
        {open ? null : <StatusIcon status={card.status} />}
        <p className="flex-1 text-sm font-medium">{card.title}</p>
        {open ? null : <span className="text-xs text-muted-foreground">{statusLabel[card.status]}</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {card.rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="flex items-start gap-1.5 text-muted-foreground">
              {row.look ? <AgentAvatar look={row.look} size={16} /> : null}
              {row.label}
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {open ? (
        <div className="flex gap-1.5">
          <Button size="xs" disabled={pending} onClick={() => onChoose("accept")}>
            Confirmar
          </Button>
          <Button variant="ghost" size="xs" disabled={pending} onClick={() => onChoose("decline")}>
            Agora não
          </Button>
        </div>
      ) : null}
    </div>
  )
}
