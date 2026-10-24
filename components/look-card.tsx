"use client"

import { useState, useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { CharterHead, QuestionCard, SalteCard, SystemEvent } from "@/components/salte"
import type { LookCard as LookCardData } from "@/lib/agent/cards"
import { avatarColors, avatarShapes, type AvatarShape } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

const shapeNames: Record<AvatarShape, string> = {
  drop: "Gota",
  square: "Quadrado",
  round: "Redondo",
  blob: "Bolha",
}

const colorNames: Record<(typeof avatarColors)[number], string> = {
  "#2f80ff": "Azul",
  "#9b6bff": "Roxo",
  "#14b8a6": "Verde-água",
  "#ff7a1a": "Laranja",
  "#ff5cae": "Rosa",
  "#2ea603": "Verde",
  "#e74c3c": "Vermelho",
  "#f5b700": "Amarelo",
}

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
        <div role="radiogroup" aria-label="Forma" className="mt-3.5 flex gap-1">
          {avatarShapes.map((shape) => (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-checked={look.shape === shape}
              aria-label={shapeNames[shape]}
              onClick={() => setLook((current) => ({ ...current, shape }))}
              className={cn(
                "rounded-xl border border-transparent p-1.5 hover:bg-soft",
                look.shape === shape && "border-line bg-soft",
              )}
            >
              <AgentAvatar look={{ ...look, shape }} size={30} />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Cor" className="mt-3 flex flex-wrap gap-2">
          {avatarColors.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={look.color === color}
              aria-label={colorNames[color]}
              onClick={() => setLook((current) => ({ ...current, color }))}
              className={cn(
                "size-6 rounded-full ring-offset-2 ring-offset-surface",
                look.color === color && "ring-2 ring-ink",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </SalteCard>
      <QuestionCard
        question={`Usar esta aparência para ${card.agentName}?`}
        disabled={pending}
        options={[
          {
            label: "Usar esta aparência",
            onClick: () => startTransition(() => actOnCardAction(agentId, messageId, "choose", look)),
          },
        ]}
      />
    </>
  )
}
