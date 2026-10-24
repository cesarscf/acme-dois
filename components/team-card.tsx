"use client"

import { PencilIcon } from "lucide-react"
import { Fragment, useState, useTransition } from "react"
import { actOnCardAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { AppearanceForm } from "@/components/appearance-form"
import { CharterHead, KeyValues, MemberBubble, QuestionCard, SalteCard, SystemEvent } from "@/components/salte"
import type { AgentChoice, TeamCard as TeamCardData } from "@/lib/agent/cards"

type Props = { agentId: string; messageId: string; card: TeamCardData }

const answers: Partial<Record<TeamCardData["status"], string>> = {
  accepted: "Confirmar",
  declined: "Agora não",
  stale: "Confirmar",
}

// Each proposed agent's charter, then its look in a card of its own, all confirmed at once.
export function TeamCard({ agentId, messageId, card }: Props) {
  const [choices, setChoices] = useState<AgentChoice[]>(() =>
    card.agents.map(({ name, shape, color }) => ({ name, shape, color })),
  )
  const [pending, startTransition] = useTransition()
  const open = card.status === "pending"
  const named = choices.every((choice) => choice.name.trim().length > 0)
  const set = (index: number, change: Partial<AgentChoice>) =>
    setChoices((current) => current.map((choice, at) => (at === index ? { ...choice, ...change } : choice)))
  const act = (choice: "accept" | "decline") =>
    startTransition(() =>
      actOnCardAction(agentId, messageId, choice, {
        team: choices.map((settled) => ({ ...settled, name: settled.name.trim() })),
      }),
    )

  return (
    <>
      {card.agents.map((agent, index) => {
        const settled = open ? choices[index] : agent
        return (
          <Fragment key={index}>
            <SalteCard className="p-4">
              {open ? (
                <div className="flex items-center gap-3">
                  <AgentAvatar look={settled} size={32} />
                  <div className="min-w-0 flex-1">
                    <label className="flex items-center gap-1.5">
                      <input
                        aria-label="Nome do agente"
                        placeholder="Dê um nome"
                        value={settled.name}
                        maxLength={40}
                        onChange={(event) => set(index, { name: event.target.value })}
                        className="-mx-1 w-full rounded-md bg-transparent px-1 text-[15px] leading-tight font-semibold text-ink outline-none hover:bg-soft focus:bg-soft placeholder:font-normal placeholder:text-faint"
                      />
                      <PencilIcon aria-hidden className="size-3.5 shrink-0 text-faint" />
                    </label>
                    <div className="text-[13.5px] text-sub">{agent.role}</div>
                  </div>
                </div>
              ) : (
                <CharterHead look={settled} title={`Ficha de ${settled.name}`} subtitle={agent.role} />
              )}
              <KeyValues
                className="mt-3.5"
                rows={agent.details.map((detail) => ({
                  label: detail.label,
                  value: <span className="line-clamp-4">{detail.value}</span>,
                }))}
              />
            </SalteCard>
            {open ? (
              <AppearanceForm name={settled.name} look={settled} onChange={(look) => set(index, look)} />
            ) : null}
          </Fragment>
        )
      })}
      <QuestionCard
        question={card.title}
        answered={!open}
        disabled={pending}
        options={[
          {
            label: "Confirmar",
            hint: named ? undefined : "Dê um nome a cada agente",
            onClick: () => named && act("accept"),
          },
          { label: "Agora não", onClick: () => act("decline") },
        ]}
      />
      {open ? null : <MemberBubble>{answers[card.status]}</MemberBubble>}
      {card.status === "stale" ? <SystemEvent>Nada foi feito: algo mudou antes da confirmação.</SystemEvent> : null}
    </>
  )
}
