import { readdirSync } from "fs"
import { eq } from "drizzle-orm"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"

// 需要忽略的文件模式
const IGNORED_PATTERNS = [/^\.registry\.json$/, /\.extracted\.md$/, /^\.DS_Store$/, /\.tmp$/]

function shouldIgnore(filename: string): boolean {
  return IGNORED_PATTERNS.some((p) => p.test(filename))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WikiUploadsTable = any

/** 启动时扫描上传目录，发现新文件和崩溃恢复 */
export async function startupScan(
  uploadsDir: string,
  db: BunSQLiteDatabase,
  wikiUploadsTable: WikiUploadsTable,
): Promise<{ newFiles: number; skipped: number }> {
  let newFiles = 0
  let skipped = 0

  // 读取目录中所有文件
  let entries: string[]
  try {
    entries = readdirSync(uploadsDir)
  } catch {
    return { newFiles: 0, skipped: 0 }
  }

  // 过滤忽略文件
  const files = entries.filter((f) => !shouldIgnore(f))

  for (const filename of files) {
    // 使用与 upload route 一致的 storedPath 格式
    const storedPath = `raw/uploads/${filename}`

    // 查询数据库中是否已有该文件
    const rows = db
      .select()
      .from(wikiUploadsTable)
      .where(eq(wikiUploadsTable.storedPath, storedPath))
      .all()

    if (rows.length > 0) {
      // 已注册，检查是否需要崩溃恢复
      const record = rows[0]
      if (record.status === "ingesting") {
        db.update(wikiUploadsTable)
          .set({ status: "pending" })
          .where(eq(wikiUploadsTable.storedPath, storedPath))
          .run()
      }
      skipped++
    } else {
      // 未注册的新文件
      newFiles++
    }
  }

  return { newFiles, skipped }
}
