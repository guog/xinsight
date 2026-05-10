import { db } from "./index"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { seedUsers } from "./seed"
import { seedProvidersFromEnv } from "@/lib/provider/seed"

/** 显式初始化数据库：迁移 + 种子数据。只在应用启动时调用一次。 */
export async function initDatabase() {
  try {
    migrate(db, { migrationsFolder: "./drizzle" })
  } catch (e) {
    console.warn("Migration skipped:", (e as Error).message)
  }
  await seedUsers().catch((e) => console.warn("Seed users failed:", (e as Error).message))
  await seedProvidersFromEnv().catch((e) => console.error("Provider seed failed:", e))
}
