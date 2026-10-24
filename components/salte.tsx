import { ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { AgentAvatar } from "@/components/agent-avatar"
import type { AgentLook } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

// Salte's conversation pieces, copied from its frames and the acme prototype's Salte theme
// (docs/referencias/salte and prototipo/web.html in the acme repo).

// A white card on the canvas, with a hairline border.
export function SalteCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("w-full rounded-2xl border border-line bg-surface", className)}>{children}</div>
}

// Gray labels in a 92px column, values beside them.
export function KeyValues({ rows, className }: { rows: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[92px_1fr] gap-x-3 gap-y-2.5 text-[14.5px] leading-snug", className)}>
      {rows.map((row, index) => (
        <div key={index} className="contents">
          <dt className="text-sub">{row.label}</dt>
          <dd className="text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// "Ficha de Otto · Confirmações": the agent's avatar, name and role over its charter.
export function CharterHead({ look, title, subtitle }: { look: AgentLook; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <AgentAvatar look={look} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-tight font-semibold text-ink">{title}</div>
        <div className="text-[13.5px] text-sub">{subtitle}</div>
      </div>
    </div>
  )
}

export type Option = { label: string; hint?: string; onClick: () => void }

// A question with lettered answers; once answered it fades and stops taking clicks.
export function QuestionCard({
  question,
  options,
  answered = false,
  disabled = false,
}: {
  question: string
  options: Option[]
  answered?: boolean
  disabled?: boolean
}) {
  return (
    <SalteCard className={cn("p-3", answered && "pointer-events-none opacity-50")}>
      <div className="px-1 pb-1.5 text-[14.5px] font-medium text-ink">{question}</div>
      {options.map((option, index) => (
        <button
          key={option.label}
          type="button"
          disabled={disabled || answered}
          onClick={option.onClick}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-soft disabled:cursor-default"
        >
          <span className="grid size-[22px] shrink-0 place-items-center rounded-md border border-line text-[10.5px] font-semibold text-sub">
            {"ABCDEF"[index]}
          </span>
          <span className="flex-1 text-[14.5px] leading-snug text-ink">
            {option.label}
            {option.hint ? <span className="block text-[13px] text-sub">{option.hint}</span> : null}
          </span>
          <ChevronRightIcon className="size-4 text-faint" />
        </button>
      ))}
    </SalteCard>
  )
}

// "Rotina criada: Confirmações, dias úteis às 10h · Desfazer"
export function SystemEvent({ children }: { children: ReactNode }) {
  return <div className="px-4 text-center text-[12.5px] leading-snug text-sub">{children}</div>
}

// The line that opens a conversation: "Otto nasceu neste chat".
export function BornDivider({ look, name }: { look: AgentLook; name: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-sub">
      <span className="h-px flex-1 bg-line" />
      <AgentAvatar look={look} size={18} />
      <span>
        <b className="font-semibold text-ink">{name}</b> nasceu neste chat
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

// The member's message: a white bubble on the right, large corners.
export function MemberBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[80%] self-end rounded-[20px] bg-surface px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap text-ink">
      {children}
    </div>
  )
}

export function Thinking({ look, text = "Pensando" }: { look: AgentLook; text?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="salte-iri rounded-[12px] p-[2.5px]">
        <span className="block rounded-[10px] bg-canvas p-[3px]">
          <AgentAvatar look={look} size={26} />
        </span>
      </span>
      <span className="salte-shimmer text-[14px]">{text}</span>
    </div>
  )
}
