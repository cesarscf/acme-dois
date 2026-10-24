import { expect, test } from "bun:test"
import { suggestionsFor } from "./suggestions"

test("the setup agent suggests starting the setup", () => {
  expect(suggestionsFor({ kind: "setup", tools: [] })).toContain("Quero montar a equipe da agenda")
})

test("a team agent only suggests what its charter lets it do", () => {
  expect(suggestionsFor({ kind: "team", tools: ["find_customers", "read_agenda"] })).toEqual([
    "Quem eu atendo amanhã?",
    "Como está a agenda de hoje?",
  ])
  expect(suggestionsFor({ kind: "team", tools: ["read_agenda", "create_appointment"] })).toContain(
    "Quero marcar uma sessão",
  )
})
