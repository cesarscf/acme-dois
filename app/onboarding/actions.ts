"use server"

import { APIError } from "better-auth/api"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/lib/auth"

export type OrganizationState = { error?: string } | undefined

const organizationName = z.string().trim().min(2, "Dê um nome à clínica.").max(80)

const slugOf = (name: string) =>
  `${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`

export async function createOrganization(_: OrganizationState, formData: FormData): Promise<OrganizationState> {
  const name = organizationName.safeParse(formData.get("name"))
  if (!name.success) return { error: name.error.issues[0].message }
  try {
    // Creating it also makes it the session's active organization.
    await auth.api.createOrganization({
      body: { name: name.data, slug: slugOf(name.data) },
      headers: await headers(),
    })
  } catch (error) {
    if (error instanceof APIError) return { error: error.message }
    throw error
  }
  redirect("/")
}
