"use client"

import { useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AgentAvatar } from "@/components/agent-avatar"
import { LookCard } from "@/components/look-card"
import type { Card as CardData } from "@/lib/agent/cards"

const statusLabel: Record<CardData["status"], string> = {
  applied: "Feito",
  undone: "Desfeito",
  pending: "Aguardando você",
  accepted: "Confirmado",
  declined: "Recusado",
  stale: "Nada foi feito",
  chosen: "Escolhida",
}

type Props = { agentId: string; messageId: string; card: CardData }

export function MessageCard({ agentId, messageId, card }: Props) {
  if (card.type === "look") return <LookCard agentId={agentId} messageId={messageId} card={card} />
  return <DecisionCard agentId={agentId} messageId={messageId} card={card} />
}

type DecisionProps = { agentId: string; messageId: string; card: Exclude<CardData, { type: "look" }> }

function DecisionCard({ agentId, messageId, card }: DecisionProps) {
  const [pending, startTransition] = useTransition()
  const act = (choice: "undo" | "accept" | "decline") =>
    startTransition(() => actOnCardAction(agentId, messageId, choice))

  return (
    <Card size="sm" className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{card.title}</CardTitle>
        {card.type === "receipt" ? (
          <CardDescription className="whitespace-pre-wrap">{card.detail}</CardDescription>
        ) : null}
        <CardAction>
          <Badge variant={card.status === "stale" ? "destructive" : "secondary"}>
            {statusLabel[card.status]}
          </Badge>
        </CardAction>
      </CardHeader>
      {card.type === "approval" ? (
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {card.rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="flex items-start gap-1.5 text-muted-foreground">
                  {row.look ? <AgentAvatar look={row.look} size={20} /> : null}
                  {row.label}
                </dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      ) : null}
      {card.type === "receipt" && card.status === "applied" && card.undoable ? (
        <CardFooter>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => act("undo")}>
            Desfazer
          </Button>
        </CardFooter>
      ) : null}
      {card.type === "approval" && card.status === "pending" ? (
        <CardFooter className="gap-2">
          <Button size="sm" disabled={pending} onClick={() => act("accept")}>
            Confirmar
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => act("decline")}>
            Agora não
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}
