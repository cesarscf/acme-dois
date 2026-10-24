import { UsersIcon } from "lucide-react"
import { AgentAvatar } from "@/components/agent-avatar"
import type { AgentLook } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

type Spot = { look: number; size: number; left: number; top: number }

// Where each mascot stands, in % of the picture, as AbacatePay stacks its bots: the first big in
// front on the left, the next beside it, overlapping, and the rest smaller behind them. Listed
// back to front, so the front ones cover the back.
const stacks: Record<1 | 2 | 3 | 4, Spot[]> = {
  1: [{ look: 0, size: 88, left: 6, top: 6 }],
  2: [
    { look: 1, size: 62, left: 36, top: 4 },
    { look: 0, size: 74, left: 2, top: 24 },
  ],
  3: [
    { look: 2, size: 56, left: 22, top: 3 },
    { look: 0, size: 70, left: 2, top: 27 },
    { look: 1, size: 60, left: 38, top: 37 },
  ],
  4: [
    { look: 2, size: 50, left: 8, top: 3 },
    { look: 3, size: 48, left: 46, top: 0 },
    { look: 0, size: 70, left: 2, top: 27 },
    { look: 1, size: 60, left: 38, top: 37 },
  ],
}

// A group as its mascots, agents and then people, four at most, standing together.
export function GroupAvatar({ looks, size = 40, className }: { looks: AgentLook[]; size?: number; className?: string }) {
  const shown = looks.slice(0, 4)
  return (
    <span aria-hidden="true" style={{ width: size, height: size }} className={cn("relative block shrink-0", className)}>
      {shown.length === 0 ? (
        <span className="grid size-full place-items-center rounded-full bg-soft text-sub">
          <UsersIcon className="size-1/2!" />
        </span>
      ) : (
        stacks[shown.length as 1 | 2 | 3 | 4].map((spot) => (
          <span
            key={spot.look}
            className="absolute"
            style={{ width: `${spot.size}%`, height: `${spot.size}%`, left: `${spot.left}%`, top: `${spot.top}%` }}
          >
            {/* Important, as the sidebar's buttons size every svg in them as an icon. */}
            <AgentAvatar look={shown[spot.look]} className="size-full!" />
          </span>
        ))
      )}
    </span>
  )
}
