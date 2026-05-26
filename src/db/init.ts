import { db } from "./index"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { seedUsers, seedBuiltinAgents, seedTeams } from "./seed"
import { seedProvidersFromEnv } from "@/lib/provider/seed"

/** 显式初始化数据库：迁移 + 种子数据。只在应用启动时调用一次。 */
export async function initDatabase() {
  try {
    migrate(db, { migrationsFolder: "./drizzle" })
  } catch (e) {
    const msg = (e as Error).message
    // 仅跳过"已存在"类的冲突错误，其他错误需要重新抛出
    // 跳过"已存在"类的冲突错误（包括 drizzle 包装后的 ALTER TABLE ADD 重复列错误）
    if (
      msg.includes("already exists") ||
      msg.includes("duplicate column") ||
      (msg.includes("Failed to run the query") && msg.includes("ADD"))
    ) {
      console.warn("Migration skipped (already applied):", msg)
    } else {
      console.error("Migration failed:", msg)
      // 回退：尝试逐条执行 db:push 式的 schema 同步
      try {
        const { execSync } = await import("child_process")
        execSync("bun run db:push", { stdio: "inherit", timeout: 30_000 })
        console.info("Fallback db:push succeeded")
      } catch (pushErr) {
        console.error("Fallback db:push also failed:", pushErr)
      }
    }
  }
  await seedUsers().catch((e: unknown) => console.warn("Seed users failed:", (e as Error).message))
  await seedBuiltinAgents().catch((e: unknown) =>
    console.warn("Seed agents failed:", (e as Error).message),
  )
  await seedTeams().catch((e: unknown) => console.warn("Seed teams failed:", (e as Error).message))
  await seedProvidersFromEnv().catch((e: unknown) => console.error("Provider seed failed:", e))
}
