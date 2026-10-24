import type Anthropic from "@anthropic-ai/sdk"
import { sql } from "drizzle-orm"
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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

// How far a member has read their conversation with an agent; newer agent messages are unread.
export const conversationRead = pgTable(
  "conversation_read",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.agentId] })],
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

// A conversation where members and agents talk together. Every organization has one general group,
// with everyone on the team and every team agent in it, whoever joins later too; any other group
// has the members and agents chosen when it was created.
export const chatGroup = pgTable(
  "chat_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    general: boolean("general").notNull().default(false),
    createdBy: text("created_by").references(() => member.id, { onDelete: "set null" }),
    // Set here, not by now(), like the messages it is listed with.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("chat_group_general_idx").on(table.organizationId).where(sql`${table.general}`),
    uniqueIndex("chat_group_name_idx").on(table.organizationId, sql`lower(${table.name})`),
  ],
)

export const chatGroupMember = pgTable(
  "chat_group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => chatGroup.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.memberId] }), index("chat_group_member_idx").on(table.memberId)],
)

export const chatGroupAgent = pgTable(
  "chat_group_agent",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => chatGroup.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.agentId] })],
)

// What is said in a group, by members and agents.
export const groupMessage = pgTable(
  "group_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => chatGroup.id, { onDelete: "cascade" }),
    author: messageAuthor("author").notNull(),
    // Who wrote it or, on an agent's message, whom the agent answered: only they act on its cards.
    memberId: text("member_id").references(() => member.id, { onDelete: "set null" }),
    // The agent that wrote it or, on a member's message, the agent called in it with @.
    agentId: uuid("agent_id").references(() => agent.id, { onDelete: "cascade" }),
    text: text("text"),
    card: jsonb("card").$type<Card>(),
    // What the card's buttons apply; never sent to the browser.
    action: jsonb("action").$type<CardAction>(),
    createdAt,
  },
  (table) => [index("group_message_group_idx").on(table.groupId, table.createdAt)],
)

// How far a member has read a group; what others wrote since is unread.
export const groupRead = pgTable(
  "group_read",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => chatGroup.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.groupId] })],
)

// What one agent saw in a group, in order: each agent keeps its own, apart from its direct
// conversations, so a member's direct conversation never reaches the group.
export const groupTranscriptEntry = pgTable(
  "group_transcript_entry",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => chatGroup.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    entry: jsonb("entry").$type<Anthropic.Beta.BetaMessageParam>().notNull(),
    // On the entry that brought the agent what the group said: when the last of it was written.
    // The agent's next turn starts after the latest one.
    readUpTo: timestamp("read_up_to", { withTimezone: true }),
  },
  (table) => [index("group_transcript_idx").on(table.groupId, table.agentId, table.seq)],
)
