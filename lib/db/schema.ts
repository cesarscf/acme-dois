import type Anthropic from "@anthropic-ai/sdk"
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import type { AgendaAction, Card } from "../agent/cards"
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

export const messageAuthor = pgEnum("message_author", ["member", "agent"])

// The direct conversation between one member and the clinic's agent, as the member sees it.
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    author: messageAuthor("author").notNull(),
    text: text("text"),
    card: jsonb("card").$type<Card>(),
    // What the card's buttons apply; never sent to the browser.
    action: jsonb("action").$type<AgendaAction>(),
    createdAt,
  },
  (table) => [index("message_member_idx").on(table.memberId, table.createdAt)],
)

// What the model saw, in order, so each turn resends the same prefix and hits the cache.
export const transcriptEntry = pgTable(
  "transcript_entry",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    entry: jsonb("entry").$type<Anthropic.Beta.BetaMessageParam>().notNull(),
  },
  (table) => [index("transcript_member_idx").on(table.memberId, table.seq)],
)
