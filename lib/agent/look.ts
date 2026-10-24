// How an agent looks: a shape and a color, drawn in the style of the AbacatePay marketplace bots.
// Shared by server and client.

export const avatarShapes = [
  "drop",
  "square",
  "round",
  "blob",
  "hexagon",
  "star",
  "capsule",
  "clover",
  "flower",
  "burst",
  "pick",
  "cloud",
  "bean",
  "egg",
  "pumpkin",
] as const
export type AvatarShape = (typeof avatarShapes)[number]

export const avatarColors = [
  "#2f80ff",
  "#9b6bff",
  "#14b8a6",
  "#ff7a1a",
  "#ff5cae",
  "#2ea603",
  "#e74c3c",
  "#f5b700",
  "#f4f4f5",
  "#a0693c",
  "#8a8a94",
] as const
export type AvatarColor = (typeof avatarColors)[number]

// The colors as the pickers show them, by hue as on Grok: white and brown first, gray last.
export const avatarColorsInOrder: readonly AvatarColor[] = [
  "#f4f4f5",
  "#a0693c",
  "#e74c3c",
  "#ff7a1a",
  "#f5b700",
  "#2ea603",
  "#14b8a6",
  "#2f80ff",
  "#9b6bff",
  "#ff5cae",
  "#8a8a94",
]

export type AgentLook = { shape: AvatarShape; color: string }

export const setupAgentLook: AgentLook = { shape: "drop", color: "#9eea6c" }

// What a new agent looks like when nobody picked: the next color and shape the team isn't using.
export function nextLook(taken: AgentLook[]): AgentLook {
  const color = avatarColors.find((candidate) => !taken.some((look) => look.color === candidate))
  return {
    shape: avatarShapes[taken.length % avatarShapes.length],
    color: color ?? avatarColors[taken.length % avatarColors.length],
  }
}

// A person has no mascot of their own: in a group's picture they get one from their id, always the
// same, in a rounded shape and one of the colors.
const personShapes: readonly AvatarShape[] = ["round", "blob", "egg", "drop", "bean", "cloud"]

export function personLook(id: string): AgentLook {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  hash >>>= 0
  return {
    shape: personShapes[hash % personShapes.length],
    color: avatarColorsInOrder[(hash >>> 8) % avatarColorsInOrder.length],
  }
}

// How a group looks: its agents, then its people, four at most.
export const groupLooks = (agents: AgentLook[], peopleIds: string[]) =>
  [...agents, ...peopleIds.map(personLook)].slice(0, 4)
