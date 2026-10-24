"use client"

import { CheckIcon } from "lucide-react"
import { AgentAvatar } from "@/components/agent-avatar"
import { SalteCard } from "@/components/salte"
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

const sectionLabel = "mb-2 text-[12.5px] font-medium text-sub"

type Props = { name: string; look: AgentLook; onChange: (look: AgentLook) => void }

// The mascot's look in a card of its own: a large preview beside the shapes and the colors.
export function AppearanceForm({ name, look, onChange }: Props) {
  return (
    <SalteCard className="p-4">
      <div className="text-[15px] leading-tight font-semibold text-ink">Aparência de {name || "agente"}</div>
      <div className="text-[13.5px] text-sub">Escolha a forma e a cor do mascote</div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="grid size-28 shrink-0 place-items-center self-center rounded-2xl bg-soft sm:self-start">
          <AgentAvatar look={look} size={76} />
        </div>

        <div className="min-w-0 flex-1">
          <div className={sectionLabel}>Forma</div>
          <div role="radiogroup" aria-label="Forma" className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {avatarShapes.map((shape) => {
              const picked = look.shape === shape
              return (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => onChange({ ...look, shape })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-1 pt-2 pb-1.5 text-[11px] transition-colors",
                    picked ? "border-ink/80 bg-soft text-ink" : "border-line text-sub hover:bg-soft",
                  )}
                >
                  <AgentAvatar look={{ ...look, shape }} size={28} />
                  {shapeNames[shape]}
                </button>
              )
            })}
          </div>

          <div className={cn(sectionLabel, "mt-4")}>Cor</div>
          <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
            {avatarColors.map((color) => {
              const picked = look.color === color
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  aria-label={colorNames[color]}
                  title={colorNames[color]}
                  onClick={() => onChange({ ...look, color })}
                  className="grid size-7 place-items-center rounded-full transition-transform hover:scale-105 sm:size-8"
                  style={{ backgroundColor: color }}
                >
                  {picked ? <CheckIcon className="size-4 text-white drop-shadow-sm" strokeWidth={3} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </SalteCard>
  )
}
