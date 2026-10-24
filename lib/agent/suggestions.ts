import type { Agent } from "../organization/agents"

// First requests offered under a conversation the member hasn't started yet.
export function suggestionsFor(agent: Pick<Agent, "kind" | "tools">) {
  if (agent.kind === "setup")
    return [
      "Somos uma clínica de fisioterapia",
      "Quero montar a equipe da agenda",
      "Quero convidar alguém da equipe",
      "O que o Acme faz hoje?",
    ]
  return [
    "Quem eu atendo amanhã?",
    "Como está a agenda de hoje?",
    ...(agent.tools.includes("create_appointment") ? ["Quero marcar uma sessão"] : []),
    ...(agent.tools.includes("reschedule_appointment") ? ["Preciso remarcar uma sessão"] : []),
  ]
}
