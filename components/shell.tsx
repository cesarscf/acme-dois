"use client"

import { createContext, type ReactNode, use } from "react"
import type { GroupCandidates } from "@/components/new-group-form"

// What the list of conversations needs around it, wherever it shows: beside the chat on a computer,
// or as its own screen on a phone. Who is signed in, and what the + offers them.
export type Shell = GroupCandidates & {
  user: { name: string; email: string }
  manages: boolean
  // The setup agent, whose conversation a new agent starts in.
  setupId: string
}

const ShellContext = createContext<Shell | null>(null)

export function ShellProvider({ shell, children }: { shell: Shell; children: ReactNode }) {
  return <ShellContext value={shell}>{children}</ShellContext>
}

export function useShell() {
  const shell = use(ShellContext)
  if (!shell) throw new Error("useShell must be used inside ShellProvider")
  return shell
}
