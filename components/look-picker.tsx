"use client"

import { AgentAvatar } from "@/components/agent-avatar"
import { type AgentLook, avatarColors, avatarShapes, type AvatarShape } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

const shapeNames: Record<AvatarShape, string> = {
  drop: "Gota",
  square: "Quadrado",
  round: "Redondo",
  blob: "Bolha",
  hexagon: "Hexágono",
  star: "Estrela",
  capsule: "Cápsula",
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

// The shapes, then the colors, each a radio group.
export function LookPicker({ look, onChange }: { look: AgentLook; onChange: (look: AgentLook) => void }) {
  return (
    <>
      <div role="radiogroup" aria-label="Forma" className="flex flex-wrap gap-1">
        {avatarShapes.map((shape) => (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={look.shape === shape}
            aria-label={shapeNames[shape]}
            onClick={() => onChange({ ...look, shape })}
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
            onClick={() => onChange({ ...look, color })}
            className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface", look.color === color && "ring-2 ring-ink")}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </>
  )
}
