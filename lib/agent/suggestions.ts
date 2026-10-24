import type { Agent } from "../organization/agents"
import { type Member, manages } from "../member"

// First requests offered under a conversation the member hasn't started yet.
export function suggestionsFor(agent: Pick<Agent, "kind" | "tools">, member: Pick<Member, "role">) {
  if (agent.kind === "setup")
    return manages(member)
      ? [
          "Somos uma clínica de fisioterapia",
          "Quero montar a equipe da agenda",
          "Quero convidar alguém da equipe",
          "O que o Acme faz hoje?",
        ]
      : [
          "Quero contar os meus horários",
          "O que cada agente faz?",
          "Como peço pra marcar uma sessão?",
          "O que o Acme faz hoje?",
        ]
  return [
    "Quem eu atendo amanhã?",
    "Como está a agenda de hoje?",
    ...(agent.tools.includes("create_appointment") ? ["Quero marcar uma sessão"] : []),
    ...(agent.tools.includes("reschedule_appointment") ? ["Preciso remarcar uma sessão"] : []),
  ]
}
