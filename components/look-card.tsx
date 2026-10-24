"use client"

import { useState, useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { AppearanceForm } from "@/components/appearance-form"
import { QuestionCard, SystemEvent } from "@/components/salte"
import type { LookCard as LookCardData } from "@/lib/agent/cards"

type Props = { agentId: string; messageId: string; card: LookCardData }

export function LookCard({ agentId, messageId, card }: Props) {
  const [look, setLook] = useState(card.look)
  const [pending, startTransition] = useTransition()

  if (card.status === "chosen")
    return (
      <SystemEvent>
        <span className="inline-flex items-center gap-1.5">
          <AgentAvatar look={card.look} size={16} />
          <span>
            <b className="font-semibold text-ink">{card.agentName}</b> ganhou uma aparência nova
          </span>
        </span>
      </SystemEvent>
    )

  return (
    <>
      <AppearanceForm name={card.agentName} look={look} onChange={setLook} />
      <QuestionCard
        question={`Usar esta aparência para ${card.agentName}?`}
        disabled={pending}
        options={[
          {
            label: "Usar esta aparência",
            onClick: () => startTransition(() => actOnCardAction(agentId, messageId, "choose", { look })),
          },
        ]}
      />
    </>
  )
}
