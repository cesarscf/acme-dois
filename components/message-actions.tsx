"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"

// Under an agent's message, as in Salte: copy, then the time.
export function MessageActions({ text, time }: { text: string; time: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <div className="mt-1.5 flex items-center gap-2.5 text-[12px] text-faint">
      <button
        type="button"
        aria-label={copied ? "Copiado" : "Copiar"}
        title={copied ? "Copiado" : "Copiar"}
        className="hover:text-sub"
        onClick={() => {
          navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => {})
        }}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </button>
      <span>{time}</span>
    </div>
  )
}
