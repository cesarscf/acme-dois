"use client"

import { BotIcon, PlusIcon, UsersIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { askForNewAgentAction, checkNewAgentAction } from "@/app/actions"
import { AgentAvatar } from "@/components/agent-avatar"
import { colorNames, shapeNames } from "@/components/appearance-form"
import { useConversations } from "@/components/conversations"
import { type GroupCandidates, NewGroupForm } from "@/components/new-group-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type AgentLook, avatarColors, avatarShapes, nextLook } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

type Props = GroupCandidates & {
  // Only who runs the organization creates agents; for anyone else the menu has groups only.
  manages: boolean
  // The setup agent, whose conversation a new agent starts in.
  setupId: string
  onNavigate?: () => void
}

type Creating = "agent" | "group" | null

// The + at the top of the list: a new agent or a new group, each in a dialog of its own.
export function CreateMenu({ manages, setupId, people, agents, onNavigate }: Props) {
  const [creating, setCreating] = useState<Creating>(null)
  const router = useRouter()
  const close = useCallback(() => setCreating(null), [])
  const openGroup = useCallback(
    (id: string) => {
      setCreating(null)
      onNavigate?.()
      router.push(`/groups/${id}`)
    },
    [router, onNavigate],
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Criar"
          className="grid size-10 place-items-center rounded-full bg-soft text-ink outline-none transition-colors hover:bg-line focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-line"
        >
          <PlusIcon className="size-5" strokeWidth={1.75} />
          <span className="sr-only">Criar</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-44">
          {manages ? (
            <DropdownMenuItem onClick={() => setCreating("agent")}>
              <BotIcon />
              Novo agente
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setCreating("group")}>
            <UsersIcon />
            Novo grupo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
          <div className="border-b border-line px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold">
              {creating === "agent" ? "Novo agente" : "Novo grupo"}
            </DialogTitle>
          </div>
          {creating === "agent" ? (
            <NewAgentForm
              taken={agents.map((agent) => agent.look)}
              setupId={setupId}
              onCancel={close}
              onAsked={() => {
                setCreating(null)
                onNavigate?.()
              }}
            />
          ) : creating === "group" ? (
            <NewGroupForm people={people} agents={agents} onCreated={openGroup} onCancel={close} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

// The new agent's name and look, as the Grok bots are made: a large preview, the name, then the
// shapes and the colors. The setup agent then asks what it will do.
function NewAgentForm({
  taken,
  setupId,
  onCancel,
  onAsked,
}: {
  taken: AgentLook[]
  setupId: string
  onCancel: () => void
  onAsked: () => void
}) {
  const router = useRouter()
  const { startWorking } = useConversations()
  const [name, setName] = useState("")
  const [look, setLook] = useState<AgentLook>(() => nextLook(taken))
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setChecking(true)
    const checked = await checkNewAgentAction(name).finally(() => setChecking(false))
    if (checked.error) return setError(checked.error)
    // The setup agent takes it from here, in the member's conversation with it.
    onAsked()
    router.push(`/agents/${setupId}`)
    const done = startWorking(setupId)
    try {
      await askForNewAgentAction(name, look)
    } finally {
      done()
    }
  }

  return (
    <form onSubmit={create} className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-col items-center gap-5 overflow-y-auto px-5 py-6">
        <AgentAvatar look={look} size={104} />
        <input
          aria-label="Nome do agente"
          placeholder="Dê um nome ao agente"
          value={name}
          maxLength={40}
          autoFocus
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          className="h-11 w-full rounded-2xl border border-line bg-transparent px-4 text-center text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink/40"
        />

        <div role="radiogroup" aria-label="Forma" className="flex flex-wrap justify-center gap-1.5">
          {avatarShapes.map((shape) => (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-checked={look.shape === shape}
              aria-label={shapeNames[shape]}
              title={shapeNames[shape]}
              onClick={() => setLook({ ...look, shape })}
              className={cn(
                "grid size-13 place-items-center rounded-full transition-transform hover:scale-105",
                look.shape === shape && "bg-soft ring-1 ring-ink/30",
              )}
            >
              <AgentAvatar look={{ ...look, shape }} size={38} />
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Cor" className="flex flex-wrap justify-center gap-2.5">
          {avatarColors.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={look.color === color}
              aria-label={colorNames[color]}
              title={colorNames[color]}
              onClick={() => setLook({ ...look, color })}
              className={cn(
                "size-8 rounded-full transition-transform hover:scale-105",
                look.color === color && "ring-2 ring-ink/40 ring-offset-2 ring-offset-popover",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {error ? <p className="text-center text-[13px] text-destructive">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="rounded-full" disabled={!name.trim() || checking}>
          Criar
        </Button>
      </div>
    </form>
  )
}
