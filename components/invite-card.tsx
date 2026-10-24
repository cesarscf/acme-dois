"use client"

import { CheckIcon, CopyIcon, MessageCircleIcon, UserPlusIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { KeyValues, SalteCard } from "@/components/salte"
import type { InviteCard as InviteCardData } from "@/lib/agent/cards"
import { organizationTimeZone } from "@/lib/member"
import { dayIn } from "@/lib/time"

const pillButton =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-soft"

// The link is sent by the member, so the card offers to copy it or open WhatsApp with it.
export function InviteCard({ card }: { card: InviteCardData }) {
  const [copied, setCopied] = useState(false)
  const link = () => `${window.location.origin}${card.path}`
  const until = dayIn(new Date(card.expiresAt), organizationTimeZone)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <SalteCard className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-soft text-sub">
          <UserPlusIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight font-semibold text-ink">Convite para {card.name}</div>
          <div className="truncate text-[13.5px] text-sub">{card.email}</div>
        </div>
      </div>
      <KeyValues
        className="mt-3.5"
        rows={[
          { label: "Vale até", value: `${until.slice(8, 10)}/${until.slice(5, 7)}` },
          { label: "Para entrar", value: `${card.name} abre o link e entra com ${card.email}` },
        ]}
      />
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          className={pillButton}
          onClick={() => {
            navigator.clipboard
              .writeText(link())
              .then(() => setCopied(true))
              .catch(() => {})
          }}
        >
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
        <button
          type="button"
          className={pillButton}
          onClick={() => {
            const text = `Oi, ${card.name}! Te convidei para a equipe no Acme: ${link()}`
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener")
          }}
        >
          <MessageCircleIcon className="size-4" />
          Enviar no WhatsApp
        </button>
      </div>
    </SalteCard>
  )
}
