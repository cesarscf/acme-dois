"use client"

import { ArrowUpIcon, LoaderCircleIcon } from "lucide-react"
import { type FormEvent, useState } from "react"
import { cn } from "@/lib/utils"

type Props = { placeholder: string; isBusy: boolean; onSubmit: (text: string) => void }

// Salte's composer: a floating white card, the text on top and the round blue send button below.
export function PromptForm({ placeholder, isBusy, onSubmit }: Props) {
  const [input, setInput] = useState("")
  const ready = !isBusy && input.trim().length > 0

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    onSubmit(text)
    setInput("")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[22px] border border-line/70 bg-surface px-3.5 pt-3 pb-2.5 shadow-[0_2px_16px_rgba(0,0,0,.06)]"
    >
      <textarea
        rows={1}
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={4000}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            handleSubmit()
          }
        }}
        className="field-sizing-content block max-h-40 min-h-[22px] w-full resize-none bg-transparent text-[15px] leading-snug text-ink outline-none placeholder:text-faint"
      />
      <div className="mt-2.5 flex items-center gap-2">
        <span className="hidden flex-1 pr-1 text-right text-[12px] text-faint lg:block">
          Enter envia · Shift+Enter quebra a linha
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
