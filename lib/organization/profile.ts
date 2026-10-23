import { eq } from "drizzle-orm"
import { db } from "../db"
import { organizationProfile } from "../db/schema"
import type { Member } from "../member"

export type OrganizationProfile = { about: string; appointmentMinutes: number | null }

export async function findOrganizationProfile(organizationId: string): Promise<OrganizationProfile | undefined> {
  const [found] = await db
    .select({ about: organizationProfile.about, appointmentMinutes: organizationProfile.appointmentMinutes })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, organizationId))
  return found
}

export async function saveOrganizationProfile(member: Member, profile: OrganizationProfile) {
  await db
    .insert(organizationProfile)
    .values({ organizationId: member.organizationId, ...profile })
    .onConflictDoUpdate({ target: organizationProfile.organizationId, set: profile })
}
