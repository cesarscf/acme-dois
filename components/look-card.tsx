"use client"

import { useState, useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { LookPicker } from "@/components/look-picker"
import { CharterHead, QuestionCard, SalteCard, SystemEvent } from "@/components/salte"
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
      <SalteCard className="p-4">
        <CharterHead look={look} title={`Aparência de ${card.agentName}`} subtitle="Escolha a forma e a cor" />
        <div className="mt-3.5">
          <LookPicker look={look} onChange={setLook} />
        </div>
      </SalteCard>
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
