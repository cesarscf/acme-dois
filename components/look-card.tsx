"use client"

import { useState, useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
  const chosen = card.status === "chosen"
  const shown = chosen ? card.look : look

  return (
    <Card size="sm" className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Aparência de {card.agentName}</CardTitle>
        {chosen ? (
          <CardAction>
            <Badge variant="secondary">Escolhida</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <AgentAvatar look={shown} size={88} />
        {chosen ? null : (
          <>
            <div role="radiogroup" aria-label="Forma" className="flex gap-2">
              {avatarShapes.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={look.shape === shape}
                  aria-label={shapeNames[shape]}
                  onClick={() => setLook((current) => ({ ...current, shape }))}
                  className={cn(
                    "rounded-xl border border-transparent p-1.5 hover:bg-muted",
                    look.shape === shape && "border-ring bg-muted",
                  )}
                >
                  <AgentAvatar look={{ ...look, shape }} size={36} />
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Cor" className="flex flex-wrap justify-center gap-2">
              {avatarColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={look.color === color}
                  aria-label={colorNames[color]}
                  onClick={() => setLook((current) => ({ ...current, color }))}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-background",
                    look.color === color && "ring-2 ring-ring",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
      {chosen ? null : (
        <CardFooter>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => actOnCardAction(agentId, messageId, "choose", look))}
          >
            Escolher
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
