"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AgentAvatar } from "@/components/agent-avatar"
import type { AgentLook } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

type NavAgent = AgentLook & { id: string; name: string; role: string }

// A row that scrolls sideways on a phone, a column beside the conversation from md up.
export function AgentNav({ agents }: { agents: NavAgent[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Agentes" className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible">
      {agents.map((agent) => {
        const href = `/agents/${agent.id}`
        const active = pathname === href
        return (
          <Link
            key={agent.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted",
              active && "bg-muted",
            )}
          >
            <AgentAvatar look={agent} />
            <span className="min-w-0">
              <span className="block font-medium">{agent.name}</span>
              <span className="hidden truncate text-xs text-muted-foreground md:block">{agent.role}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
