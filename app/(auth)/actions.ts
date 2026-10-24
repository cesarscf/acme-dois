"use server"

import { APIError } from "better-auth/api"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/lib/auth"

export type AuthState = { error?: string } | undefined

const credentials = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
})

const signUpInput = credentials.extend({
  name: z.string().trim().min(1, "Diga seu nome."),
})

// Back to the invite that sent them here, or on to the app.
const inviteOf = (formData: FormData) => {
  const invite = z.uuid().safeParse(formData.get("invite"))
  return invite.success ? `/invites/${invite.data}` : undefined
}

const failure = (error: unknown): AuthState => {
  if (error instanceof APIError) return { error: error.message }
  throw error
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await auth.api.signUpEmail({ body: parsed.data, headers: await headers() })
  } catch (error) {
    return failure(error)
  }
  redirect(inviteOf(formData) ?? "/onboarding")
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() })
  } catch (error) {
    return failure(error)
  }
  redirect(inviteOf(formData) ?? "/")
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() })
  redirect("/sign-in")
}
