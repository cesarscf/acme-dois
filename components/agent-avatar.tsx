import type { AgentLook, AvatarShape } from "@/lib/agent/look"

// In the style of the AbacatePay marketplace bots: a colored body, a shine and two eyes.

// Each shape's body, and where its face sits on it.
const shapes: Record<AvatarShape, { body: string; shine: [number, number]; eyes: number }> = {
  drop: {
    body: "M50 5C62 5 94 40 94 63C94 85 75 97 50 97C25 97 6 85 6 63C6 40 38 5 50 5Z",
    shine: [30, 40],
    eyes: 50,
  },
  square: {
    body: "M34 10H66C80 10 92 22 92 36V66C92 80 80 92 66 92H34C20 92 8 80 8 66V36C8 22 20 10 34 10Z",
    shine: [30, 30],
    eyes: 40,
  },
  round: {
    body: "M50 8A44 44 0 1 1 50 96A44 44 0 1 1 50 8Z",
    shine: [30, 32],
    eyes: 42,
  },
  blob: {
    body: "M54 7C80 9 95 30 93 56C91 82 70 96 45 93C20 90 5 72 7 47C9 22 30 5 54 7Z",
    shine: [30, 30],
    eyes: 40,
  },
}

export function AgentAvatar({ look, size = 40, className }: { look: AgentLook; size?: number; className?: string }) {
  const { body, shine, eyes } = shapes[look.shape]
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 -6 100 112"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <ellipse cx="50" cy="101" rx="30" ry="3.5" fill="currentColor" opacity="0.08" />
      <path d={body} fill={look.color} />
      <ellipse
        cx={shine[0]}
        cy={shine[1]}
        rx="9"
        ry="5"
        transform={`rotate(-30 ${shine[0]} ${shine[1]})`}
        fill="#fff"
        opacity="0.22"
      />
      <rect x="35" y={eyes} width="9" height="20" rx="4.5" fill="#fff" />
      <rect x="53" y={eyes} width="9" height="20" rx="4.5" fill="#fff" />
    </svg>
  )
}
