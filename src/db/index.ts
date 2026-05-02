import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "./schema"

const sqlite = new Database(process.env.DATABASE_URL ?? "./data/xinsight.db")
export const db = drizzle(sqlite, { schema })
export type DB = typeof db

// Auto-migrate on first import
try {
  migrate(db, { migrationsFolder: "./drizzle" })
} catch (e) {
  // Migration may fail if already applied, ignore
  console.warn("Migration skipped or already applied:", (e as Error).message)
}

// Seed default users (admin + guest) — idempotent
import { seedUsers } from "./seed"
seedUsers().catch((e) => console.warn("Seed users failed:", (e as Error).message))

// Seed LLM providers from env vars on first startup
import { seedProvidersFromEnv } from "@/lib/provider-seed"
seedProvidersFromEnv().catch((e) => console.error("Provider seed failed:", e))
