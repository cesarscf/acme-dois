import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { createOrganization, resetDatabase } from "@/test/fixtures"
import { scriptedModel, says, uses } from "@/test/scripted-model"
import { createAppointment, findAppointment } from "../agenda/appointments"
import { createCustomer } from "../agenda/customers"
import type { Model } from "../agent/model"
import { unanswered } from "../agent/run-turn"
import type { Member } from "../member"
import { actOnCard, listMessages, sendMessage } from "./conversation"

// Friday 2026-10-23, 09:00 in São Paulo.
const now = new Date("2026-10-23T12:00:00Z")

let ana: Member
let bia: Member
let carla: { id: string; name: string }

beforeEach(async () => {
  await resetDatabase()
  ;[ana, bia] = await createOrganization("Ana", "Bia")
  carla = await createCustomer(ana, { name: "Carla" })
})

const book = () =>
  createAppointment(ana, { customerId: carla.id, memberId: ana.id, startsAt: new Date("2026-10-23T13:00:00Z") })

const shown = async (member: Member) =>
  (await listMessages(member)).map(({ author, text, card }) => ({ author, text, card }))

describe("sendMessage", () => {
  test("stores the exchange and tells the agent who speaks, the team and the time", async () => {
    const { model, requests } = scriptedModel(says("Oi, Ana!"))
    await sendMessage(ana, "Oi", { model, now })

    expect(await shown(ana)).toEqual([
      { author: "member", text: "Oi", card: null },
      { author: "agent", text: "Oi, Ana!", card: null },
    ])
    const [first] = requests
    expect(first.messages[0]).toEqual({ role: "user", content: "Oi" })
    expect(first.messages[1]).toMatchObject({ role: "system", clear_at: "next_user_message" })
    const context = first.messages[1].content as string
    expect(context).toContain("Agora: 2026-10-23 09:00")
    expect(context).toContain(`Quem fala com você: Ana (member_id ${ana.id})`)
    expect(context).toContain(`- Bia (member_id ${bia.id})`)
  })

  test("resends the whole transcript, unchanged, on the next turn", async () => {
    const { model, requests } = scriptedModel(says("Oi!"), says("Tudo bem."))
    await sendMessage(ana, "Oi", { model, now })
    await sendMessage(ana, "Tudo bem?", { model, now })
    expect(requests[1].messages.slice(0, 3)).toEqual([...requests[0].messages, { role: "assistant", content: [{ type: "text", text: "Oi!" }] }])
  })

  test("keeps each member's conversation to themselves", async () => {
    const { model } = scriptedModel(says("Oi, Ana!"))
    await sendMessage(ana, "Oi", { model, now })
    expect(await listMessages(bia)).toEqual([])
  })

  test("never sends a card's action to the browser", async () => {
    const original = await book()
    const { model } = scriptedModel(
      uses({ name: "cancel_appointment", input: { appointment_id: original.id, reason: null } }),
      says("Pedi sua confirmação."),
    )
    await sendMessage(ana, "Cancela a Carla de hoje", { model, now })
    const card = (await listMessages(ana)).find((row) => row.card)!
    expect(card.card).toMatchObject({ type: "approval", status: "pending" })
    expect(card).not.toHaveProperty("action")
  })

  test("answers that it couldn't, and leaves the transcript as it was, when the model fails", async () => {
    spyOn(console, "error").mockImplementationOnce(() => {})
    const failing: Model = async () => {
      throw new Error("overloaded")
    }
    await sendMessage(ana, "Oi", { model: failing, now })
    expect((await shown(ana)).at(-1)).toEqual({ author: "agent", text: unanswered, card: null })

    const { model, requests } = scriptedModel(says("Oi!"))
    await sendMessage(ana, "Oi de novo", { model, now })
    expect(requests[0].messages.map((entry) => entry.role)).toEqual(["user", "system"])
  })
})

describe("actOnCard", () => {
  async function askToCancel() {
    const original = await book()
    const { model } = scriptedModel(
      uses({ name: "cancel_appointment", input: { appointment_id: original.id, reason: null } }),
      says("Confirma?"),
    )
    await sendMessage(ana, "Cancela a Carla", { model, now })
    const cardMessage = (await listMessages(ana)).find((row) => row.card)!
    return { original, cardMessage }
  }

  test("accepting an approval cancels the session and tells the agent", async () => {
    const { original, cardMessage } = await askToCancel()
    expect(await actOnCard(ana, cardMessage.id, "accept")).toMatchObject({ status: "accepted" })
    expect((await findAppointment(ana, original.id))?.status).toBe("cancelled")

    const { model, requests } = scriptedModel(says("Pronto."))
    await sendMessage(ana, "Obrigada", { model, now })
    const note = requests[0].messages.at(-3)
    expect(note).toEqual({
      role: "user",
      content: '[Aviso do Cuida, não escrito pelo membro] Ana confirmou "Cancelar a sessão?".',
    })
  })

  test("declining leaves the session scheduled", async () => {
    const { original, cardMessage } = await askToCancel()
    expect(await actOnCard(ana, cardMessage.id, "decline")).toMatchObject({ status: "declined" })
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })

  test("an approval is stale when the session changed after the agent asked", async () => {
    const { original, cardMessage } = await askToCancel()
    const { model } = scriptedModel(
      uses({ name: "assign_appointment", input: { appointment_id: original.id, member_id: bia.id } }),
      says("Agora com a Bia."),
    )
    await sendMessage(ana, "Passa a Carla para a Bia", { model, now })
    expect(await actOnCard(ana, cardMessage.id, "accept")).toMatchObject({ status: "stale" })
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })

  test("undoing a receipt puts the agenda back, once", async () => {
    const { model } = scriptedModel(
      uses({
        name: "create_appointment",
        input: { customer_id: carla.id, day: "2026-10-23", time: "15:00", duration_minutes: null, kind: null, member_id: null },
      }),
      says("Marquei."),
    )
    await sendMessage(ana, "Marca a Carla às 15h", { model, now })
    const receipt = (await listMessages(ana)).find((row) => row.card)!
    expect(await actOnCard(ana, receipt.id, "undo")).toMatchObject({ status: "undone" })
    expect(await actOnCard(ana, receipt.id, "undo")).toMatchObject({ status: "undone" })
  })

  test("another member can't act on someone else's card", async () => {
    const { original, cardMessage } = await askToCancel()
    expect(await actOnCard(bia, cardMessage.id, "accept")).toBeUndefined()
    expect((await findAppointment(ana, original.id))?.status).toBe("scheduled")
  })
})
