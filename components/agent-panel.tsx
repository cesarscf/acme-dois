"use client"

import { PencilIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { updateAgentLookAction, updateAgentProfileAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { colorNames, shapeNames } from "@/components/appearance-form"
import { GroupAvatar } from "@/components/group-avatar"
import { EditableText, PanelTabs, SidePanel } from "@/components/side-panel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { type AgentLook, avatarColorsInOrder, avatarShapes } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

export type AgentProfile = {
  id: string
  kind: "setup" | "team"
  name: string
  role: string
  look: AgentLook
  // Only who runs the organization changes an agent; the setup agent keeps its name and role.
  canEditLook: boolean
  canEditProfile: boolean
  // A team agent's charter, as the panel lists it; none for the setup agent.
  charter: { label: string; items: string[] }[] | null
  instructions: string | null
  groups: { id: string; name: string; looks: AgentLook[] }[]
}

type Tab = "details" | "groups"

// The agent's panel beside the conversation, as Grok's: its face, name and role, then what it does
// and where it talks.
export function AgentPanel({ agent, onClose }: { agent: AgentProfile; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("details")
  return (
    <SidePanel onClose={onClose} color={agent.look.color} hero={<LookPicker agent={agent} />}>
      <div className="flex flex-col items-center px-6 pt-5">
        <EditableText
          key={`name-${agent.name}`}
          value={agent.name}
          editable={agent.canEditProfile}
          label="Nome do agente"
          maxLength={40}
          onSave={(name) => updateAgentProfileAction(agent.id, { name })}
          className="text-[22px] font-semibold text-ink"
        />
        <EditableText
          key={`role-${agent.role}`}
          value={agent.role}
          editable={agent.canEditProfile}
          label="Cargo do agente"
          maxLength={80}
          onSave={(role) => updateAgentProfileAction(agent.id, { role })}
          className="mt-0.5 text-[14px] text-sub"
        />

        <PanelTabs
          tabs={[
            ["details", "Detalhes"],
            ["groups", "Grupos"],
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-6 pt-6 pb-10">
        {tab === "details" ? <Details agent={agent} /> : <Groups agent={agent} />}
      </div>
    </SidePanel>
  )
}

function Details({ agent }: { agent: AgentProfile }) {
  if (!agent.charter)
    return (
      <p className="text-[14.5px] leading-relaxed text-sub">
        A {agent.name} entende como a clínica trabalha, monta a equipe de agentes com quem administra a clínica e tira
        dúvidas sobre o app. Ela não mexe na agenda.
      </p>
    )
  return (
    <div className="flex flex-col gap-5">
      {agent.charter.map((section) => (
        <section key={section.label}>
          <h3 className="mb-1.5 text-[13px] font-medium text-sub">{section.label}</h3>
          <ul className="flex flex-col gap-1 text-[14.5px] text-ink">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      {agent.instructions ? (
        <section>
          <h3 className="mb-1.5 text-[13px] font-medium text-sub">Instruções</h3>
          <p className="rounded-2xl bg-soft p-4 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">
            {agent.instructions}
          </p>
        </section>
      ) : null}
    </div>
  )
}

function Groups({ agent }: { agent: AgentProfile }) {
  if (!agent.groups.length)
    return <p className="text-center text-[14.5px] text-sub">{agent.name} não está em nenhum grupo seu.</p>
  return (
    <ul className="flex flex-col gap-1">
      {agent.groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="flex items-center gap-3 rounded-2xl px-2 py-2 text-[15px] text-ink hover:bg-soft"
          >
            <GroupAvatar looks={group.looks} size={36} />
            {group.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

// The avatar, with a pencil at its top right for who may change it: a popover with the shapes and
// the colors, each saved as it's picked.
function LookPicker({ agent }: { agent: AgentProfile }) {
  const [look, setLook] = useState(agent.look)
  const [openedWith, setOpenedWith] = useState(agent.look)
  if (!agent.canEditLook) return <AgentAvatar look={agent.look} size={112} />

  const pick = (next: AgentLook) => {
    setLook(next)
    void updateAgentLookAction(agent.id, next)
  }

  return (
    <Popover onOpenChange={(open) => open && setOpenedWith(look)}>
      <span className="relative">
        <AgentAvatar look={look} size={112} />
        {/* A small round pencil at the top right, as on a profile picture, over nothing else. */}
        <PopoverTrigger
          aria-label="Mudar a aparência"
          title="Mudar a aparência"
          className="absolute top-1 -right-1 grid size-9 place-items-center rounded-full border border-line bg-surface text-ink shadow-sm outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-soft"
        >
          <PencilIcon className="size-4" />
        </PopoverTrigger>
      </span>
      <PopoverContent className="w-[340px] gap-0 rounded-3xl p-0" sideOffset={10}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="rounded-full bg-soft px-3 py-1 text-[14px] font-medium text-ink">Mascote</span>
          <button
            type="button"
            onClick={() => pick(openedWith)}
            disabled={look.shape === openedWith.shape && look.color === openedWith.color}
            className="text-[14px] text-sub hover:text-ink disabled:opacity-40"
          >
            Desfazer
          </button>
        </div>
        <div role="radiogroup" aria-label="Forma" className="mx-auto grid w-fit grid-cols-5 gap-1.5 px-4 pt-4">
          {avatarShapes.map((shape) => (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-checked={look.shape === shape}
              aria-label={shapeNames[shape]}
              title={shapeNames[shape]}
              onClick={() => pick({ ...look, shape })}
              data-bot-hover=""
              className={cn(
                "grid size-13 place-items-center rounded-full transition-transform hover:scale-105",
                look.shape === shape && "ring-1 ring-ink/30",
              )}
            >
              <AgentAvatar look={{ ...look, shape }} size={38} />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Cor" className="flex flex-wrap justify-center gap-2.5 px-4 pt-4 pb-5">
          {avatarColorsInOrder.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={look.color === color}
              aria-label={colorNames[color]}
              title={colorNames[color]}
              onClick={() => pick({ ...look, color })}
              className={cn(
                "size-8 rounded-full transition-transform hover:scale-105",
                look.color === color && "ring-2 ring-ink/40 ring-offset-2 ring-offset-popover",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
