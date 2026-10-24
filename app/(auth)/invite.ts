import { findInvite } from "@/lib/organization/invites"

// The invite that sent someone to sign in or up, while it can still be accepted.
export async function openInvite(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const { invite } = await searchParams
  if (typeof invite !== "string" || !/^[0-9a-f-]{36}$/i.test(invite)) return undefined
  const found = await findInvite(invite)
  return found?.open ? { id: found.id, email: found.email, organizationName: found.organizationName } : undefined
}
