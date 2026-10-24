import { eq } from "drizzle-orm"
import { db } from "../db"
import { memberProfile, organizationProfile } from "../db/schema"
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

// Replaces how the member works, as they told it; nobody writes another member's.
export async function saveMemberProfile(member: Member, about: string) {
  await db
    .insert(memberProfile)
    .values({ memberId: member.id, organizationId: member.organizationId, about })
    .onConflictDoUpdate({ target: memberProfile.memberId, set: { about } })
}
