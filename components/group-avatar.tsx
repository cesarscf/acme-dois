import { UsersIcon } from "lucide-react"
import { AgentAvatar } from "@/components/agent-avatar"
import type { AgentLook } from "@/lib/agent/look"
import { cn } from "@/lib/utils"

// Where each small avatar sits, in % of the whole: one on top and two below, as a group of bots.
const spots = {
  1: [{ left: 21, top: 21 }],
  2: [
    { left: 0, top: 0 },
    { left: 42, top: 42 },
  ],
  3: [
    { left: 21, top: 0 },
    { left: 0, top: 42 },
    { left: 42, top: 42 },
  ],
} as const

// A group as its agents, stacked, each ringed in the color behind it (`ring`, a bg- class). With
// no agents, the people in it.
export function GroupAvatar({
  looks,
  size = 40,
  ring = "bg-sidebar",
  className,
}: {
  looks: AgentLook[]
  size?: number
  ring?: string
  className?: string
}) {
  const shown = looks.slice(0, 3)
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn("relative block shrink-0", className)}
    >
      {shown.length === 0 ? (
        <span className="grid size-full place-items-center rounded-full bg-soft text-sub">
          <UsersIcon className="size-1/2" />
        </span>
      ) : (
        spots[shown.length as 1 | 2 | 3].map((spot, index) => (
          <span
            key={index}
            style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
            className={cn("absolute size-[58%] rounded-full p-[6%]", ring)}
          >
            <AgentAvatar look={shown[index]} className="size-full" />
          </span>
        ))
      )}
    </span>
  )
}
