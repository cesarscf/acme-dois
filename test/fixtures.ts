import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { member, organization, user } from "@/lib/db/schema"
import type { Member } from "@/lib/member"
import { createGeneralGroup } from "@/lib/chat/groups"
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
  await createGeneralGroup(organizationId)
  return Promise.all(
    names.map(async (name) => {
      const userId = crypto.randomUUID()
      const id = crypto.randomUUID()
      await db.insert(user).values({ id: userId, name, email: `${userId}@example.com`, createdAt: now, updatedAt: now })
      await db.insert(member).values({ id, organizationId, userId, role: "owner", createdAt: now })
      return { id, organizationId, userId, name, joinedAt: now, role: "owner" }
    }),
  )
}

// Someone who joins an existing organization at `joinedAt`, as accepting an invite does.
export async function joinOrganization(organizationId: string, name: string, joinedAt = new Date()): Promise<Member> {
  const userId = crypto.randomUUID()
  const id = crypto.randomUUID()
  await db.insert(user).values({ id: userId, name, email: `${userId}@example.com`, createdAt: joinedAt, updatedAt: joinedAt })
  await db.insert(member).values({ id, organizationId, userId, role: "member", createdAt: joinedAt })
  return { id, organizationId, userId, name, joinedAt, role: "member" }
}
