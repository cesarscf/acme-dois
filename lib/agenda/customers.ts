import { and, asc, eq, ilike } from "drizzle-orm"
import { db } from "../db"
import { customer } from "../db/schema"
import type { Member } from "../member"

export async function listCustomers(member: Member, search?: string) {
  return db
    .select({ id: customer.id, name: customer.name, phone: customer.phone })
    .from(customer)
    .where(
      and(
        eq(customer.organizationId, member.organizationId),
        search ? ilike(customer.name, `%${search.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
      ),
    )
    .orderBy(asc(customer.name))
}

export async function createCustomer(member: Member, input: { name: string; phone?: string | null }) {
  const [created] = await db
    .insert(customer)
    .values({ organizationId: member.organizationId, name: input.name, phone: input.phone || null })
    .returning({ id: customer.id, name: customer.name })
  return created
}

export async function findCustomer(member: Member, id: string) {
  const [found] = await db
    .select({ id: customer.id, name: customer.name })
    .from(customer)
    .where(and(eq(customer.id, id), eq(customer.organizationId, member.organizationId)))
  return found
}
