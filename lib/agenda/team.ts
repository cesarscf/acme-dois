import { asc, eq } from "drizzle-orm"
import { db } from "../db"
import { member, memberProfile, user } from "../db/schema"
import { manages } from "../member"

// The organization's members, by member id, with the names the team reads, whether they run the
// organization, and how they work when they said.
export async function listTeam(organizationId: string) {
  const rows = await db
    .select({ id: member.id, name: user.name, role: member.role, about: memberProfile.about })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(memberProfile, eq(memberProfile.memberId, member.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(user.name), asc(member.id))
  return rows.map(({ role, ...teammate }) => ({ ...teammate, manages: manages({ role }) }))
}

export type Teammate = Awaited<ReturnType<typeof listTeam>>[number]
