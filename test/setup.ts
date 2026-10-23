import { mock } from "bun:test"

// Tests run against their own database (docker/postgres-init.sql), migrated before any file runs.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://acme:acme@localhost:5433/acme_test"

// It throws outside a React Server environment; under test there is no client bundle to guard.
mock.module("server-only", () => ({}))

const { db } = await import("@/lib/db")
const { migrate } = await import("drizzle-orm/postgres-js/migrator")
await migrate(db, { migrationsFolder: "./drizzle" })
