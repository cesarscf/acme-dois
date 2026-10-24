import { ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// The Salte way: cards stand apart by their background, with no border or shadow.
export const cardFrame = "w-full max-w-md rounded-2xl bg-muted/60 text-card-foreground"

export function CardTitle({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-3 pb-1 text-sm font-medium">{children}</p>
}

// Two columns: the label in gray, the value beside it.
export function KeyValues({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-4 gap-y-1.5 px-3 py-2 text-sm">
      {rows.map((row, index) => (
        <div key={index} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// One answer of a question card, with its letter.
export function OptionRow({
  letter,
  label,
  hint,
  disabled,
  onClick,
}: {
  letter: string
  label: string
  hint?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] text-muted-foreground">
        {letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

export function Options({ children }: { children: ReactNode }) {
  return <div className="flex flex-col px-1 pb-1">{children}</div>
}

// A small centered line for what happened, like "Sessão marcada: … · Desfazer".
export function SystemEvent({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("w-full px-6 text-center text-xs text-muted-foreground", className)}>{children}</p>
}

// The member's answer to a question card, shown as their own bubble.
export function AnswerBubble({ children }: { children: ReactNode }) {
  return (
    <p className="self-end rounded-3xl bg-muted px-3 py-2 text-sm">{children}</p>
  )
}
