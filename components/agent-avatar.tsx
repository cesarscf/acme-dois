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
  // Drawn here in the same style, with rounded corners.
  hexagon: {
    body: "M39.6 10.0Q50.0 4.0 60.4 10.0L80.3 21.5Q90.7 27.5 90.7 39.5L90.7 62.5Q90.7 74.5 80.3 80.5L60.4 92.0Q50.0 98.0 39.6 92.0L19.7 80.5Q9.3 74.5 9.3 62.5L9.3 39.5Q9.3 27.5 19.7 21.5Z",
    shine: [30, 32],
    eyes: 42,
  },
  star: {
    body: "M43.5 15.6Q50.0 8.0 56.5 15.6L62.3 22.5Q68.8 30.1 78.1 33.9L86.4 37.4Q95.7 41.2 90.4 49.7L85.7 57.4Q80.4 65.9 79.7 75.9L79.0 84.9Q78.2 94.8 68.5 92.5L59.7 90.4Q50.0 88.0 40.3 90.4L31.5 92.5Q21.8 94.8 21.0 84.9L20.3 75.9Q19.6 65.9 14.3 57.4L9.6 49.7Q4.3 41.2 13.6 37.4L21.9 33.9Q31.2 30.1 37.7 22.5Z",
    shine: [40, 36],
    eyes: 47,
  },
  capsule: {
    body: "M30 18H70C86 18 96 32 96 51C96 70 86 84 70 84H30C14 84 4 70 4 51C4 32 14 18 30 18Z",
    shine: [24, 34],
    eyes: 41,
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
