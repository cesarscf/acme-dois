import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins/organization"
import { asc, eq } from "drizzle-orm"
import { db } from "./db"
import * as schema from "./db/schema"
import { createGeneralGroup } from "./organization/groups"
import { createSetupAgent } from "./organization/agents"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  // The session is read from a signed cookie for 5 minutes instead of the database on every page.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  databaseHooks: {
    session: {
      create: {
        // A new session opens in the first organization the account joined.
        before: async (session) => {
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1)
          return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } }
        },
      },
    },
  },
  // nextCookies must stay last: it sets the cookies of auth calls made inside Server Actions.
  plugins: [
    organization({
      // Invites are links shared by hand and must be opened with the invited email; nobody's
      // email is verified here, so verifying it can't be the condition to accept.
      requireEmailVerificationOnInvitation: false,
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await Promise.all([createSetupAgent(organization.id), createGeneralGroup(organization.id)])
        },
      },
    }),
    nextCookies(),
  ],
})
