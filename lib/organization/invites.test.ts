import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { createOrganization, joinOrganization, resetDatabase } from "@/test/fixtures"
import { db } from "../db"
import { invitation } from "../db/schema"
import type { Member } from "../member"
import { createInvite, findInvite, InviteError, inviteDays, listPendingInvites } from "./invites"

let cesar: Member

beforeEach(async () => {
  await resetDatabase()
  ;[cesar] = await createOrganization("Cesar")
})

const now = new Date("2026-10-23T12:00:00Z")

describe("createInvite", () => {
  test("invites the email, lowercased, for 7 days, with an id no one can guess", async () => {
    const invite = await createInvite(cesar, { email: " Joana@Clinica.com " }, now)
    expect(invite.email).toBe("joana@clinica.com")
    expect(invite.expiresAt.getTime() - now.getTime()).toBe(inviteDays * 86_400_000)
    expect(invite.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  test("renews the pending invite instead of making another", async () => {
    const first = await createInvite(cesar, { email: "joana@clinica.com" }, now)
    const later = new Date(now.getTime() + 86_400_000)
    const again = await createInvite(cesar, { email: "JOANA@clinica.com" }, later)
    expect(again.id).toBe(first.id)
    expect(again.expiresAt.getTime()).toBeGreaterThan(first.expiresAt.getTime())
    expect(await db.select().from(invitation)).toHaveLength(1)
  })

  test("refuses someone who is already in the organization", async () => {
    const [ana] = await createOrganization("Ana")
    await expect(createInvite(cesar, { email: `${cesar.userId}@example.com` })).rejects.toBeInstanceOf(InviteError)
    // Someone in another organization can still be invited.
    expect(await createInvite(cesar, { email: `${ana.userId}@example.com` })).toBeDefined()
  })
})

describe("findInvite", () => {
  test("shows who invited, to which organization, and whether it still opens", async () => {
    const invite = await createInvite(cesar, { email: "joana@clinica.com" }, now)
    expect(await findInvite(invite.id, now)).toMatchObject({
      email: "joana@clinica.com",
      organizationName: "Clínica",
      inviterName: "Cesar",
      open: true,
    })
    const after = new Date(now.getTime() + (inviteDays + 1) * 86_400_000)
    expect(await findInvite(invite.id, after)).toMatchObject({ open: false })
  })

  test("is closed once accepted", async () => {
    const invite = await createInvite(cesar, { email: "joana@clinica.com" }, now)
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, invite.id))
    expect(await findInvite(invite.id, now)).toMatchObject({ status: "accepted", open: false })
  })
})

test("listPendingInvites leaves out expired and other organizations' invites", async () => {
  const [ana] = await createOrganization("Ana")
  await createInvite(cesar, { email: "joana@clinica.com" }, now)
  await createInvite(cesar, { email: "old@clinica.com" }, new Date(now.getTime() - 30 * 86_400_000))
  await createInvite(ana, { email: "theirs@clinica.com" }, now)
  expect((await listPendingInvites(cesar, now)).map((invite) => invite.email)).toEqual(["joana@clinica.com"])
})

test("only who runs the organization invites", async () => {
  const joana = await joinOrganization(cesar.organizationId, "Joana")
  await expect(createInvite(joana, { email: "bia@clinica.com" }, now)).rejects.toThrow(InviteError)
  expect(await listPendingInvites(cesar, now)).toEqual([])
})
