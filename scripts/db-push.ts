/**
 * 数据库初始化脚本 — 使用 bun:sqlite 创建表结构
 * drizzle-kit push 依赖 better-sqlite3（Node 原生模块），在 Bun 下不兼容
 * 此脚本直接读取 drizzle 生成的 SQL 文件并执行
 *
 * 用法：bun run db:push
 */
import { Database } from "bun:sqlite"
import { readdir, readFile } from "fs/promises"
import { join } from "path"

const dbPath = process.env.DATABASE_URL ?? "./data/xinsight.db"
const migrationsDir = "./drizzle"

// 确保 data 目录存在
await Bun.write("./data/.gitkeep", "")

const db = new Database(dbPath)
db.exec("PRAGMA journal_mode=WAL")
db.exec("PRAGMA foreign_keys=ON")

// 读取并执行所有 migration SQL 文件
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort()

for (const file of files) {
  const sql = await readFile(join(migrationsDir, file), "utf-8")
  // drizzle-kit 使用 "--> statement-breakpoint" 分隔语句
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    try {
      db.exec(stmt)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // 忽略 "table already exists" 错误
      if (!msg.includes("already exists") && !msg.includes("duplicate column name")) {
        console.error(`执行失败: ${stmt}\n错误: ${msg}`)
        process.exit(1)
      }
    }
  }
  console.log(`✓ ${file}`)
}

const tables = db
  .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()
console.log(
  `\n数据库初始化完成，共 ${tables.length} 张表:`,
  tables.map((t: Record<string, string>) => t.name).join(", "),
)
