import type Anthropic from "@anthropic-ai/sdk"
import { sql } from "drizzle-orm"
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import type { Card, CardAction } from "../agent/cards"
import { avatarShapes } from "../agent/look"
import { member, organization } from "./auth-schema"

export * from "./auth-schema"

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt,
  },
  (table) => [index("customer_organization_idx").on(table.organizationId)],
)

export const appointmentStatus = pgEnum("appointment_status", [
  "scheduled",
  "done",
  "missed",
  "cancelled",
])

export const appointment = pgTable(
  "appointment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    // Who attends; null when nobody is assigned yet.
    memberId: text("member_id").references(() => member.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    kind: text("kind"),
    status: appointmentStatus("status").notNull().default("scheduled"),
    // Rescheduling cancels the appointment and books a new one that points back to it.
    rescheduledFromId: uuid("rescheduled_from_id").references((): AnyPgColumn => appointment.id),
    createdAt,
    // Undo and Approvals apply only while the appointment is still at the version they saw. Set
    // here rather than by now(), whose microseconds a JS Date can't hold to compare against.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("appointment_organization_starts_idx").on(table.organizationId, table.startsAt)],
)

// How the organization works, as the setup agent learned it; every agent reads it.
export const organizationProfile = pgTable("organization_profile", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  about: text("about").notNull(),
  // What a new appointment lasts unless someone says otherwise.
  appointmentMinutes: integer("appointment_minutes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

// How one member works, in their own words: what they attend and when. Agents read it to book
// sessions with them; each member changes only their own.
export const memberProfile = pgTable("member_profile", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => member.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  about: text("about").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

// `setup` is the one agent every organization starts with, which builds the rest of the team.
export const agentKind = pgEnum("agent_kind", ["setup", "team"])

export const avatarShape = pgEnum("avatar_shape", avatarShapes)

export const agent = pgTable(
  "agent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: agentKind("kind").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    shape: avatarShape("shape").notNull().default("round"),
    color: text("color").notNull().default("#2f80ff"),
    // Its standing instructions: what it does for the organization and how.
    instructions: text("instructions").notNull(),
    // The tools it may use, and those of them it uses without asking a member first.
    tools: text("tools").array().notNull(),
    actsAlone: text("acts_alone").array().notNull(),
    // Set here, not by now(): it is compared with when members joined, which Better Auth sets in
    // JS, and the database's clock may differ from the app's.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agent_setup_idx").on(table.organizationId).where(sql`${table.kind} = 'setup'`),
    uniqueIndex("agent_name_idx").on(table.organizationId, sql`lower(${table.name})`),
  ],
)

export const messageAuthor = pgEnum("message_author", ["member", "agent"])

// The direct conversation between one member and one agent, as the member sees it.
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    author: messageAuthor("author").notNull(),
    text: text("text"),
    card: jsonb("card").$type<Card>(),
    // What the card's buttons apply; never sent to the browser.
    action: jsonb("action").$type<CardAction>(),
    createdAt,
  },
  (table) => [index("message_conversation_idx").on(table.memberId, table.agentId, table.createdAt)],
)

// What the model saw, in order, so each turn resends the same prefix and hits the cache.
export const transcriptEntry = pgTable(
  "transcript_entry",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    entry: jsonb("entry").$type<Anthropic.Beta.BetaMessageParam>().notNull(),
  },
  (table) => [index("transcript_conversation_idx").on(table.memberId, table.agentId, table.seq)],
)
