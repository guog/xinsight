import { mkdirSync, readdirSync } from "fs"
import { join } from "path"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { wikiUploads, wikiSettings } from "@/db/schema"
import { startFileWatcher } from "./file-watcher"
import { startupScan } from "./startup-scan"
import { validateAndRegister } from "./validate"
import { triggerIngest } from "./ingest-pipeline"
import { taskRunner } from "./task-runner"

// 知识库路径配置
const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")
const UPLOAD_DIR = join(WIKI_PATH, "raw", "uploads")

/** 查询 autoIngest 设置 */
function getAutoIngest(): boolean {
  const rows = db.select().from(wikiSettings).where(eq(wikiSettings.key, "autoIngest")).all()
  return rows.length > 0 && rows[0].value === "true"
}

/** 获取所有 pending 状态的上传记录 */
function getPendingUploads(): { id: string }[] {
  return db
    .select({ id: wikiUploads.id })
    .from(wikiUploads)
    .where(eq(wikiUploads.status, "pending"))
    .all()
}

/** 知识库启动初始化 */
export async function initWiki() {
  console.log("[wiki] 知识库初始化开始...")

  // 1. 确保上传目录存在
  mkdirSync(UPLOAD_DIR, { recursive: true })
  console.log(`[wiki] 上传目录已就绪: ${UPLOAD_DIR}`)

  // 2. 启动扫描 — 崩溃恢复 + 统计新文件
  const scanResult = await startupScan(UPLOAD_DIR, db, wikiUploads)
  console.log(`[wiki] 启动扫描完成: 新文件 ${scanResult.newFiles}, 跳过 ${scanResult.skipped}`)

  // 3. 对未注册的文件调用 validateAndRegister
  const files = readdirSync(UPLOAD_DIR)
  let registered = 0
  for (const filename of files) {
    // 跳过辅助文件
    if (filename.startsWith(".") || filename.endsWith(".extracted.md") || filename.endsWith(".tmp"))
      continue
    const filePath = join(UPLOAD_DIR, filename)
    const storedRel = `raw/uploads/${filename}`
    // 检查是否已注册
    const existing = db
      .select()
      .from(wikiUploads)
      .where(eq(wikiUploads.storedPath, storedRel))
      .all()
    if (existing.length === 0) {
      await validateAndRegister(
        { filePath, storedPath: storedRel, source: "scan" },
        { db, wikiUploads },
      )
      registered++
    }
  }
  if (registered > 0) {
    console.log(`[wiki] 注册了 ${registered} 个新文件`)
  }

  // 4. 如果 autoIngest 为 true，对所有 pending 记录触发摄入
  const autoIngest = getAutoIngest()
  if (autoIngest) {
    const pending = getPendingUploads()
    console.log(`[wiki] autoIngest 已启用，触发 ${pending.length} 个待处理任务`)
    for (const { id } of pending) {
      triggerIngest(id, db, wikiUploads, WIKI_PATH, taskRunner)
    }
  }

  // 5. 启动文件监听
  startFileWatcher(UPLOAD_DIR, {
    onNewFile: async (filePath: string) => {
      console.log(`[wiki] 检测到新文件: ${filePath}`)
      const filename = filePath.split("/").pop() || ""
      const storedPath = `raw/uploads/${filename}`
      const result = await validateAndRegister(
        { filePath, storedPath, source: "watch" },
        { db, wikiUploads },
      )
      // 如果注册成功且 autoIngest，自动触发摄入
      if (result.success && result.uploadId && getAutoIngest()) {
        triggerIngest(result.uploadId, db, wikiUploads, WIKI_PATH, taskRunner)
      }
    },
  })
  console.log("[wiki] 文件监听已启动")

  console.log("[wiki] 知识库初始化完成 ✓")
}
