"use client"

import { XIcon } from "lucide-react"
import { type CSSProperties, type ReactNode, useState, useTransition } from "react"
import { cn } from "@/lib/utils"

// The color of the wash, or the colors of a group's fade: the first three, the last repeated
// when there are fewer.
function washOf(color: string | string[]) {
  if (!Array.isArray(color)) return { "--c": color } as CSSProperties
  const colors = color.length ? color : ["#377fe6"]
  const at = (index: number) => colors[Math.min(index, colors.length - 1)]
  return { "--c1": at(0), "--c2": at(1), "--c3": at(2) } as CSSProperties
}

// The panel beside a conversation, as Grok's: closed by the round X, the whole screen on a phone.
// On top, `hero` (the mascot) on a wash of its color, as AbacatePay's marketplace shows its bots;
// a group's mascots each lend theirs to a fade.
export function SidePanel({
  onClose,
  color,
  hero,
  children,
}: {
  onClose: () => void
  color: string | string[]
  hero: ReactNode
  children: ReactNode
}) {
  return (
    <aside className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-surface lg:static lg:z-auto lg:w-[min(520px,45%)] lg:shrink-0 lg:border-l lg:border-line">
      <div
        className={cn("relative grid h-[200px] shrink-0 place-items-center", Array.isArray(color) ? "panel-hero-group" : "panel-hero")}
        style={washOf(color)}
      >
        {hero}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-surface/85 text-ink hover:bg-surface"
        >
          <XIcon className="size-5" strokeWidth={1.75} />
        </button>
      </div>
      {children}
    </aside>
  )
}

export function PanelTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly (readonly [T, string])[]
  value: T
  onChange: (tab: T) => void
}) {
  return (
    <div role="tablist" className="mt-6 flex gap-1">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-[14.5px] transition-colors",
            value === id ? "bg-soft font-medium text-ink" : "text-sub hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// A name or a role, edited in place: saved when the field loses focus or on Enter, put back on
// Escape or when saving fails.
export function EditableText({
  value,
  editable,
  label,
  maxLength,
  onSave,
  className,
}: {
  value: string
  editable: boolean
  label: string
  maxLength: number
  onSave: (text: string) => Promise<{ error?: string }>
  className: string
}) {
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  if (!editable) return <div className={cn("max-w-full truncate text-center", className)}>{value}</div>

  const save = () => {
    const next = text.trim()
    if (!next || next === value) return setText(value)
    startSaving(async () => {
      const result = await onSave(next)
      if (result.error) {
        setError(result.error)
        setText(value)
      } else setError(null)
    })
  }

  return (
    <>
      <input
        aria-label={label}
        value={text}
        disabled={saving}
        maxLength={maxLength}
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") {
            setText(value)
            requestAnimationFrame(() => event.currentTarget?.blur())
          }
        }}
        style={{ width: `${Math.max(text.length, 4) + 2}ch` }}
        className={cn(
          "max-w-full rounded-xl bg-transparent px-2 py-0.5 text-center outline-none hover:bg-soft focus:bg-soft",
          className,
        )}
      />
      {error ? <p className="mt-1 text-[12.5px] text-destructive">{error}</p> : null}
    </>
  )
}
