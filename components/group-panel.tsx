"use client"

import { PlusIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState, useTransition } from "react"
import { changeGroupAction, renameGroupAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { GroupAvatar } from "@/components/group-avatar"
import { EditableText, PanelTabs, SidePanel } from "@/components/side-panel"
import type { AgentLook } from "@/lib/agent/look"

type Person = { id: string; name: string }
type GroupAgent = { id: string; name: string; role: string; look: AgentLook }

export type GroupProfile = {
  id: string
  name: string
  general: boolean
  // Who created it, or runs the organization, renames it and changes who is in it; the general
  // group stays as it is, with everyone.
  canManage: boolean
  // Its agents, then its people, four at most.
  looks: AgentLook[]
  you: string
  people: Person[]
  agents: GroupAgent[]
  // Who could come in: the rest of the team and its agenda agents.
  outside: { people: Person[]; agents: GroupAgent[] }
}

type Tab = "people" | "agents"

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const PersonAvatar = ({ name }: { name: string }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft text-[14px] font-semibold text-sub">
    {name.trim().charAt(0).toUpperCase()}
  </span>
)

const AgentLine = ({ agent }: { agent: GroupAgent }) => (
  <>
    <AgentAvatar look={agent.look} size={36} />
    <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">
      {agent.name}
      <span className="block truncate text-[13px] text-sub">{agent.role}</span>
    </span>
  </>
)

// The group's panel beside the conversation, as the agent's: its agents stacked, its name, then
// who is in it, with who may change the group putting people and agents in or out.
export function GroupPanel({ group, onClose }: { group: GroupProfile; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("people")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startChange] = useTransition()

  const change = (input: Parameters<typeof changeGroupAction>[1]) =>
    startChange(async () => {
      const result = await changeGroupAction(group.id, input)
      setError(result.error ?? null)
    })

  const outside = tab === "people" ? group.outside.people : group.outside.agents

  return (
    <SidePanel
      onClose={onClose}
      color={[...new Set(group.looks.map((look) => look.color))]}
      hero={<GroupAvatar looks={group.looks} size={120} />}
    >
      <div className="flex flex-col items-center px-6 pt-5">
        <EditableText
          key={group.name}
          value={group.name}
          editable={group.canManage}
          label="Nome do grupo"
          maxLength={40}
          onSave={(name) => renameGroupAction(group.id, name)}
          className="text-[22px] font-semibold text-ink"
        />
        <div className="mt-0.5 text-[14px] text-sub">
          {group.general
            ? "Toda a equipe e todos os agentes"
            : `${count(group.people.length, "pessoa", "pessoas")} · ${count(group.agents.length, "agente", "agentes")}`}
        </div>

        <PanelTabs
          tabs={[
            ["people", "Pessoas"],
            ["agents", "Agentes"],
          ]}
          value={tab}
          onChange={(next) => {
            setTab(next)
            setAdding(false)
            setError(null)
          }}
        />
      </div>

      <div className="px-6 pt-6 pb-10">
        <ul className="flex flex-col gap-1" aria-busy={pending}>
          {tab === "people"
            ? group.people.map((person) => (
                <Row
                  key={person.id}
                  onRemove={
                    group.canManage && person.id !== group.you
                      ? () => change({ removeMemberIds: [person.id] })
                      : undefined
                  }
                  removeLabel={`Tirar ${person.name} do grupo`}
                  disabled={pending}
                >
                  <PersonAvatar name={person.name} />
                  <span className="flex-1 text-[15px] text-ink">
                    {person.name}
                    {person.id === group.you ? <span className="text-sub"> (você)</span> : null}
                  </span>
                </Row>
              ))
            : group.agents.map((agent) => (
                <Row
                  key={agent.id}
                  onRemove={group.canManage ? () => change({ removeAgentIds: [agent.id] }) : undefined}
                  removeLabel={`Tirar ${agent.name} do grupo`}
                  disabled={pending}
                >
                  <Link href={`/agents/${agent.id}`} data-bot-hover="" className="flex min-w-0 flex-1 items-center gap-3">
                    <AgentLine agent={agent} />
                  </Link>
                </Row>
              ))}
        </ul>

        {tab === "agents" && !group.agents.length ? (
          <p className="py-2 text-center text-[14.5px] text-sub">Este grupo ainda não tem agentes.</p>
        ) : null}

        {group.general ? (
          <p className="px-2 pt-3 text-[12.5px] text-faint">No geral estão sempre toda a equipe e todos os agentes.</p>
        ) : group.canManage && outside.length ? (
          adding ? (
            <div className="mt-3 rounded-2xl border border-line p-1.5">
              <div className="px-2 pt-1 pb-1.5 text-[12.5px] font-medium text-sub">
                {tab === "people" ? "Adicionar pessoas" : "Adicionar agentes"}
              </div>
              <ul className="flex flex-col gap-0.5">
                {tab === "people"
                  ? group.outside.people.map((person) => (
                      <AddRow
                        key={person.id}
                        disabled={pending}
                        label={`Adicionar ${person.name}`}
                        onAdd={() => change({ addMemberIds: [person.id] })}
                      >
                        <PersonAvatar name={person.name} />
                        <span className="flex-1 text-[15px] text-ink">{person.name}</span>
                      </AddRow>
                    ))
                  : group.outside.agents.map((agent) => (
                      <AddRow
                        key={agent.id}
                        disabled={pending}
                        label={`Adicionar ${agent.name}`}
                        onAdd={() => change({ addAgentIds: [agent.id] })}
                      >
                        <AgentLine agent={agent} />
                      </AddRow>
                    ))}
              </ul>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-[15px] text-ink hover:bg-soft"
            >
              <span className="grid size-9 place-items-center rounded-full bg-soft">
                <PlusIcon className="size-4" />
              </span>
              {tab === "people" ? "Adicionar pessoas" : "Adicionar agentes"}
            </button>
          )
        ) : null}

        {tab === "agents" && group.agents.length ? (
          <p className="px-2 pt-3 text-[12.5px] text-faint">Escreva @ e o nome de um agente para chamá-lo no grupo.</p>
        ) : null}
        {error ? <p className="pt-3 text-center text-[13px] text-destructive">{error}</p> : null}
      </div>
    </SidePanel>
  )
}

function Row({
  children,
  onRemove,
  removeLabel,
  disabled,
}: {
  children: ReactNode
  onRemove?: () => void
  removeLabel: string
  disabled: boolean
}) {
  return (
    <li className="group flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-soft">
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          title={removeLabel}
          className="grid size-8 shrink-0 place-items-center rounded-full text-sub opacity-100 hover:bg-line hover:text-ink disabled:opacity-40 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </li>
  )
}

function AddRow({
  children,
  onAdd,
  label,
  disabled,
}: {
  children: ReactNode
  onAdd: () => void
  label: string
  disabled: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        data-bot-hover=""
        disabled={disabled}
        aria-label={label}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-soft disabled:opacity-50"
      >
        {children}
        <PlusIcon className="size-4 text-sub" />
      </button>
    </li>
  )
}
