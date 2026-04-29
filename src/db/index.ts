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
