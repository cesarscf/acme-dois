import "server-only"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { auth } from "./auth"
import { db } from "./db"
import { member, organization } from "./db/schema"
import type { Member } from "./member"

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

// The signed-in member of the active organization; sends anyone else to sign in or to create an organization.
export const requireMember = cache(async (): Promise<Member> => {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) redirect("/onboarding")
  const [found] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
  if (!found) redirect("/onboarding")
  return { id: found.id, organizationId, name: session.user.name }
})

export const getOrganizationName = cache(async (organizationId: string) => {
  const [found] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
  return found?.name ?? ""
})
