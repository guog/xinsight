import { join } from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "./schema"

const dbPath =
  process.env.DATABASE_PATH ??
  process.env.DATABASE_URL ??
  join(process.cwd(), "data", "xinsight.db")
const sqlite = new Database(dbPath)
sqlite.exec("PRAGMA foreign_keys = ON;")
export const db = drizzle(sqlite, { schema })
export type DB = typeof db

// 内存数据库需要自动建表（测试环境）
if (dbPath === ":memory:") {
  try {
    migrate(db, { migrationsFolder: "./drizzle" })
  } catch {
    // ignore migration errors in test
  }
}
