"use client"

import { ArrowUpIcon, LoaderCircleIcon } from "lucide-react"
import { type FormEvent, useRef, useState } from "react"
import { AgentAvatar } from "@/components/agent-avatar"
import type { AgentLook } from "@/lib/agent/look"
import { mentionBeingTyped } from "@/lib/chat/mentions"
import { cn } from "@/lib/utils"

// An agent the member can call with @ here.
export type Mentionable = { id: string; name: string; role: string; look: AgentLook }

type Props = {
  placeholder: string
  isBusy: boolean
  onSubmit: (text: string) => void
  // In a group, typing @ suggests its agents.
  mentions?: Mentionable[]
}

// Salte's composer: a floating white card, the text on top and the round blue send button below.
export function PromptForm({ placeholder, isBusy, onSubmit, mentions = [] }: Props) {
  const [input, setInput] = useState("")
  const [caret, setCaret] = useState(0)
  const [highlighted, setHighlighted] = useState(0)
  // The mention the member closed with Escape, so it stays closed while they keep typing it.
  const [dismissed, setDismissed] = useState<number | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const ready = !isBusy && input.trim().length > 0

  const typed = mentionBeingTyped(input.slice(0, caret))
  const typedAt = typed === undefined ? -1 : caret - typed.length - 1
  const options =
    typed === undefined || dismissed === typedAt
      ? []
      : mentions.filter((agent) => agent.name.toLowerCase().startsWith(typed.toLowerCase())).slice(0, 6)
  const active = options[Math.min(highlighted, options.length - 1)]

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    onSubmit(text)
    setInput("")
    setCaret(0)
  }

  function choose(agent: Mentionable) {
    const before = `${input.slice(0, typedAt)}@${agent.name} `
    setInput(before + input.slice(caret))
    setCaret(before.length)
    setHighlighted(0)
    requestAnimationFrame(() => {
      textarea.current?.focus()
      textarea.current?.setSelectionRange(before.length, before.length)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-[22px] border border-line/70 bg-surface px-3.5 pt-3 pb-2.5 shadow-[0_2px_16px_rgba(0,0,0,.06)]"
    >
      {options.length ? (
        <ul
          role="listbox"
          aria-label="Agentes do grupo"
          className="absolute inset-x-2 bottom-full mb-2 overflow-hidden rounded-2xl border border-line/70 bg-surface p-1 shadow-[0_2px_16px_rgba(0,0,0,.08)]"
        >
          {options.map((agent) => (
            <li key={agent.id} role="option" aria-selected={agent === active}>
              <button
                type="button"
                // Keeps the focus, and the caret, in the text.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(agent)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left",
                  agent === active && "bg-soft",
                )}
              >
                <AgentAvatar look={agent.look} size={24} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                  <b className="font-semibold">{agent.name}</b>
                  <span className="text-sub"> · {agent.role}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={textarea}
        rows={1}
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={4000}
        value={input}
        onChange={(event) => {
          setInput(event.target.value)
          setCaret(event.target.selectionStart)
          setHighlighted(0)
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (options.length) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              const step = event.key === "ArrowDown" ? 1 : -1
              setHighlighted((options.indexOf(active) + step + options.length) % options.length)
              return
            }
            if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              choose(active)
              return
            }
            if (event.key === "Escape") {
              event.preventDefault()
              setDismissed(typedAt)
              return
            }
          }
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            handleSubmit()
          }
        }}
        className="field-sizing-content block max-h-40 min-h-[22px] w-full resize-none bg-transparent text-[15px] leading-snug text-ink outline-none placeholder:text-faint"
      />
      <div className="mt-2.5 flex items-center gap-2">
        <span className="hidden flex-1 pr-1 text-right text-[12px] text-faint lg:block">
          {mentions.length ? "@ chama um agente · " : ""}Enter envia · Shift+Enter quebra a linha
        </span>
        <span className="flex-1 lg:hidden" />
        <button
          type="submit"
          disabled={!ready}
          aria-label={isBusy ? "Aguardando a resposta" : "Enviar"}
          className={cn(
            "grid size-9 place-items-center rounded-full text-white",
            ready || isBusy ? "bg-brand" : "bg-brand-off",
          )}
        >
          {isBusy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <ArrowUpIcon className="size-4" />}
        </button>
      </div>
    </form>
  )
}
