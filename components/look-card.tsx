"use client"

import { useState, useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { cardFrame, OptionRow, Options, SystemEvent } from "@/components/card-frame"
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
      <SystemEvent className="flex items-center justify-center gap-1.5">
        <AgentAvatar look={card.look} size={16} />
        <span>
          <span className="font-medium text-foreground">{card.agentName}</span> ganhou uma aparência nova
        </span>
      </SystemEvent>
    )

  return (
    <div className={cn(cardFrame, "flex flex-col gap-3 pt-3")}>
      <div className="flex items-center gap-3 px-3">
        <AgentAvatar look={look} size={40} />
        <div className="min-w-0">
          <p className="text-sm font-medium">Aparência de {card.agentName}</p>
          <p className="text-xs text-muted-foreground">Escolha a forma e a cor</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Forma" className="flex gap-1 px-3">
        {avatarShapes.map((shape) => (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={look.shape === shape}
            aria-label={shapeNames[shape]}
            onClick={() => setLook((current) => ({ ...current, shape }))}
            className={cn(
              "rounded-lg border border-transparent p-1 hover:bg-muted",
              look.shape === shape && "border-ring bg-muted",
            )}
          >
            <AgentAvatar look={{ ...look, shape }} size={28} />
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-1.5 px-3">
        {avatarColors.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={look.color === color}
            aria-label={colorNames[color]}
            onClick={() => setLook((current) => ({ ...current, color }))}
            className={cn(
              "size-5 rounded-full ring-offset-2 ring-offset-muted",
              look.color === color && "ring-2 ring-ring",
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <Options>
        <OptionRow
          letter="A"
          label="Usar esta aparência"
          disabled={pending}
          onClick={() => startTransition(() => actOnCardAction(agentId, messageId, "choose", look))}
        />
      </Options>
    </div>
  )
}
