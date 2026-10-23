import { asc, eq } from "drizzle-orm"
import { db } from "../db"
import { member, user } from "../db/schema"

// The organization's members, by member id, with the names the team reads.
export async function listTeam(organizationId: string) {
  return db
    .select({ id: member.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(user.name))
}
