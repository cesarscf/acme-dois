import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { member, organization, user } from "@/lib/db/schema"
import type { Member } from "@/lib/member"
import { createSetupAgent } from "@/lib/organization/agents"

export async function resetDatabase() {
  await db.execute(
    sql`TRUNCATE "user", organization CASCADE`,
  )
}

// An organization with one member per name, each with their own account.
export async function createOrganization(...names: string[]): Promise<Member[]> {
  const organizationId = crypto.randomUUID()
  const now = new Date()
  await db.insert(organization).values({ id: organizationId, name: "Clínica", slug: organizationId, createdAt: now })
  await createSetupAgent(organizationId)
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
