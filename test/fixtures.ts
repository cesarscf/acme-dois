import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { member, organization, user } from "@/lib/db/schema"
import type { Member } from "@/lib/member"

export async function resetDatabase() {
  await db.execute(
    sql`TRUNCATE "user", organization, customer, appointment, message, transcript_entry CASCADE`,
  )
}

// An organization with one member per name, each with their own account.
export async function createOrganization(...names: string[]): Promise<Member[]> {
  const organizationId = crypto.randomUUID()
  const now = new Date()
  await db.insert(organization).values({ id: organizationId, name: "Clínica", slug: organizationId, createdAt: now })
  return Promise.all(
    names.map(async (name) => {
      const userId = crypto.randomUUID()
      const id = crypto.randomUUID()
      await db.insert(user).values({ id: userId, name, email: `${userId}@example.com`, createdAt: now, updatedAt: now })
      await db.insert(member).values({ id, organizationId, userId, role: "owner", createdAt: now })
      return { id, organizationId, name }
    }),
  )
}
