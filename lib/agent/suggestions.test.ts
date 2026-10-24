import { expect, test } from "bun:test"
import { suggestionsFor } from "./suggestions"

test("the setup agent suggests starting the setup", () => {
  expect(suggestionsFor({ kind: "setup", tools: [] }, { role: "owner" })).toContain("Quero montar a equipe da agenda")
})

test("a team agent only suggests what its charter lets it do", () => {
  expect(suggestionsFor({ kind: "team", tools: ["find_customers", "read_agenda"] }, { role: "owner" })).toEqual([
    "Quem eu atendo amanhã?",
    "Como está a agenda de hoje?",
  ])
  expect(suggestionsFor({ kind: "team", tools: ["read_agenda", "create_appointment"] }, { role: "member" })).toContain(
    "Quero marcar uma sessão",
  )
})

test("the setup agent helps someone who doesn't run the organization find their way, not build the team", () => {
  const suggestions = suggestionsFor({ kind: "setup", tools: [] }, { role: "member" })
  expect(suggestions).toContain("Quero contar os meus horários")
  expect(suggestions).not.toContain("Quero montar a equipe da agenda")
  expect(suggestions).not.toContain("Quero convidar alguém da equipe")
})
