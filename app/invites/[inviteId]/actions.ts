"use server"

import { APIError } from "better-auth/api"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/lib/auth"

export type AcceptState = { error?: string } | undefined

// Better Auth checks the invite is pending, unexpired and for this account's email, then makes the
// account a member and the organization the session's active one.
export async function acceptInvite(inviteId: string): Promise<AcceptState> {
  const invitationId = z.uuid().parse(inviteId)
  try {
    await auth.api.acceptInvitation({ body: { invitationId }, headers: await headers() })
  } catch (error) {
    if (error instanceof APIError) return { error: "Não deu para aceitar este convite. Peça um novo a quem te convidou." }
    throw error
  }
  redirect("/")
}

// Signed in with another email: sign out and come back to sign in with the invited one.
export async function switchAccount(inviteId: string) {
  const id = z.uuid().parse(inviteId)
  await auth.api.signOut({ headers: await headers() })
  redirect(`/sign-in?invite=${id}`)
}
