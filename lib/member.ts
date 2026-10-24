// The person acting, as a member of their active organization. Every read and change is scoped to it.
export type Member = {
  id: string
  organizationId: string
  // The account behind the membership, which invites name as who sent them.
  userId: string
  // When they joined the organization; agents created before that welcome them.
  joinedAt: Date
  name: string
  // Better Auth's role: "owner", "admin" or "member", comma-separated when there are several.
  role: string
}

// The owner and admins run the organization: only they build the team of agents, invite people
// and change how the organization works. Everyone else talks to the agents and says how they work.
export const manages = (member: Pick<Member, "role">) =>
  member.role.split(",").some((role) => ["owner", "admin"].includes(role.trim()))

// Every organization runs on Brasília time for now.
export const organizationTimeZone = "America/Sao_Paulo"
