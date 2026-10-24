import type { AgentLook } from "./look"

// Cards are typed blocks inside an agent's message. The member acts on them; what each action
// applies lives in `CardAction`, kept on the server.

export type ReceiptCard = {
  type: "receipt"
  title: string
  detail: string
  // `stale` when the appointment changed after the receipt, so undoing it would clobber that.
  status: "applied" | "undone" | "stale"
  undoable: boolean
}

export type ApprovalCard = {
  type: "approval"
  title: string
  // A row about an agent shows as its charter: avatar, name, role and what it does.
  rows: { label: string; value: string; look?: AgentLook; details?: { label: string; value: string }[] }[]
  status: "pending" | "accepted" | "declined" | "stale"
}

// The member picks an agent's shape and color right in the card.
export type LookCard = {
  type: "look"
  agentName: string
  look: AgentLook
  status: "pending" | "chosen"
}

export type Card = ReceiptCard | ApprovalCard | LookCard

// Puts `restore` back on an appointment while it is still at `updatedAt`.
export type Restore = {
  id: string
  updatedAt: string
  restore: { status?: "scheduled" | "cancelled"; memberId?: string | null }
}

// An agent the setup agent proposes, as the member confirms it.
export type ProposedAgent = AgentLook & {
  name: string
  role: string
  instructions: string
  tools: string[]
  actsAlone: string[]
}

export type CardAction =
  | { kind: "undo"; restores: Restore[] }
  | { kind: "cancel"; appointmentId: string; updatedAt: string }
  // A tool call the agent may not make alone, run as asked once a member confirms it.
  | { kind: "apply"; tool: string; input: unknown }
  | { kind: "create_agents"; agents: ProposedAgent[] }
  | { kind: "look"; agentId: string }
