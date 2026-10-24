"use client"

import { useActionState, useEffect } from "react"
import { createGroupAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { Button } from "@/components/ui/button"
import type { AgentLook } from "@/lib/agent/look"

export type GroupCandidates = {
  // The rest of the team: whoever creates the group is always in it.
  people: { id: string; name: string }[]
  agents: { id: string; name: string; role: string; look: AgentLook }[]
}

type Props = GroupCandidates & { onCreated: (id: string) => void; onCancel: () => void }

function Choice({ name, value, children }: { name: string; value: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-soft">
      <input type="checkbox" name={name} value={value} className="size-4 accent-brand" />
      {children}
    </label>
  )
}

const sectionLabel = "px-2 pb-1 text-[12.5px] font-medium text-sub"

// The group's name, then who is in it: people, and the agents they can call with @.
export function NewGroupForm({ people, agents, onCreated, onCancel }: Props) {
  const [state, formAction, pending] = useActionState(createGroupAction, undefined)
  useEffect(() => {
    if (state?.id) onCreated(state.id)
  }, [state, onCreated])

  return (
    <form action={formAction} className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-5">
        <input
          name="name"
          aria-label="Nome do grupo"
          placeholder="Dê um nome ao grupo"
          maxLength={40}
          required
          autoFocus
          className="h-11 w-full rounded-2xl border border-line bg-transparent px-4 text-center text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink/40"
        />

        <div>
          <div className={sectionLabel}>Pessoas</div>
          <div className="flex items-center gap-3 px-2 py-1.5 text-[14.5px] text-sub">
            <input type="checkbox" checked disabled className="size-4 accent-brand" aria-label="Você" />
            Você
          </div>
          {people.map((person) => (
            <Choice key={person.id} name="memberId" value={person.id}>
              <span className="text-[14.5px] text-ink">{person.name}</span>
            </Choice>
          ))}
        </div>

        <div>
          <div className={sectionLabel}>Agentes</div>
          {agents.length ? (
            agents.map((agent) => (
              <Choice key={agent.id} name="agentId" value={agent.id}>
                <AgentAvatar look={agent.look} size={26} />
                <span className="min-w-0 flex-1 text-[14.5px] leading-snug text-ink">
                  {agent.name}
                  <span className="block truncate text-[13px] text-sub">{agent.role}</span>
                </span>
              </Choice>
            ))
          ) : (
            <p className="px-2 text-[13px] text-sub">Ainda não há agentes de agenda.</p>
          )}
          <p className="px-2 pt-1 text-[12.5px] text-faint">
            No grupo, um agente só responde quando alguém escreve @ com o nome dele.
          </p>
        </div>

        {state?.error ? <p className="text-center text-[13px] text-destructive">{state.error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="rounded-full" disabled={pending}>
          Criar
        </Button>
      </div>
    </form>
  )
}
