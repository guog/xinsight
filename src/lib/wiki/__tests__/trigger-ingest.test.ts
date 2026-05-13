// triggerIngest 单元测试
import { describe, it, expect, beforeEach, vi } from "vitest"

// mock 模块 - 必须在导入 ingest-pipeline 之前
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => () => ({}),
}))
vi.mock("ai", () => ({
  generateText: async () => ({ text: "[]" }),
}))
vi.mock("glob", () => ({
  glob: async () => [],
}))

import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { eq } from "drizzle-orm"
import { TaskRunner } from "../task-runner"
import { triggerIngest } from "../ingest-pipeline"

// 内联定义 wiki_uploads 表结构（与 schema.ts 对齐）
const wikiUploads = sqliteTable("wiki_uploads", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedPath: text("stored_path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status").notNull().default("pending"),
  ingestTaskId: text("ingest_task_id"),
  ingestProgress: integer("ingest_progress").notNull().default(0),
  ingestError: text("ingest_error"),
  invalidReason: text("invalid_reason"),
  pagesCreated: text("pages_created"),
  source: text("source").notNull().default("upload"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

// 建表 SQL
const CREATE_TABLE = `
  CREATE TABLE wiki_uploads (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    ingest_task_id TEXT,
    ingest_progress INTEGER NOT NULL DEFAULT 0,
    ingest_error TEXT,
    invalid_reason TEXT,
    pages_created TEXT,
    source TEXT NOT NULL DEFAULT 'upload',
    uploaded_at INTEGER NOT NULL,
    ingested_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`

// 等待 TaskRunner 异步任务完成的辅助函数
async function waitForTask(runner: TaskRunner, taskId: string, timeout = 2000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const task = runner.getTask(taskId)
    if (task && (task.status === "completed" || task.status === "failed")) return
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe("triggerIngest", () => {
  let db: ReturnType<typeof drizzle>
  let runner: TaskRunner
  let tmpDir: string

  beforeEach(async () => {
    const sqlite = new Database(":memory:")
    sqlite.run(CREATE_TABLE)
    db = drizzle(sqlite)
    runner = new TaskRunner()
    tmpDir = join(tmpdir(), `trigger-ingest-test-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
  })

  // 辅助：插入一条上传记录
  function insertUpload(id: string, storedPath: string) {
    const now = new Date()
    db.insert(wikiUploads)
      .values({
        id,
        originalName: "test.pdf",
        storedPath,
        mimeType: "application/pdf",
        size: 1024,
        sha256: "abc123",
        status: "pending",
        source: "upload",
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  function getUpload(id: string) {
    return db.select().from(wikiUploads).where(eq(wikiUploads.id, id)).get()
  }

  it("找不到 uploadId 时返回错误", () => {
    const result = triggerIngest("nonexistent", db, wikiUploads, tmpDir, runner)
    expect(result).toEqual({ error: "上传记录不存在: nonexistent" })
  })

  it("成功摄入后更新 DB 状态为 completed", async () => {
    const mdPath = join(tmpDir, "test.extracted.md")
    await writeFile(mdPath, "# 测试文档\n这是内容")
    insertUpload("upload-1", join(tmpDir, "test.pdf"))

    const mockIngestFn = async () => ({ pages: ["notes/test-doc.md"] })

    const result = triggerIngest("upload-1", db, wikiUploads, tmpDir, runner, {
      ingestFn: mockIngestFn,
    })
    expect("taskId" in result).toBe(true)

    const taskId = (result as { taskId: string }).taskId
    await waitForTask(runner, taskId)

    const record = getUpload("upload-1")
    expect(record!.status).toBe("completed")
    expect(record!.pagesCreated).toBe(JSON.stringify(["notes/test-doc.md"]))
    expect(record!.ingestProgress).toBe(100)
    expect(record!.ingestedAt).toBeTruthy()
    expect(record!.ingestTaskId).toBe(taskId)
  })

  it(".extracted.md 不存在时标记 failed", async () => {
    insertUpload("upload-2", join(tmpDir, "missing.pdf"))

    const mockIngestFn = async () => ({ pages: [] })
    const result = triggerIngest("upload-2", db, wikiUploads, tmpDir, runner, {
      ingestFn: mockIngestFn,
    })
    expect("taskId" in result).toBe(true)

    const taskId = (result as { taskId: string }).taskId
    await waitForTask(runner, taskId)

    const record = getUpload("upload-2")
    expect(record!.status).toBe("failed")
    expect(record!.ingestError).toContain("提取文件不存在")
  })

  it("ingestFn 抛错时标记 failed", async () => {
    const mdPath = join(tmpDir, "error.extracted.md")
    await writeFile(mdPath, "# 会失败的文档")
    insertUpload("upload-3", join(tmpDir, "error.pdf"))

    const mockIngestFn = async () => {
      throw new Error("LLM 调用失败")
    }

    const result = triggerIngest("upload-3", db, wikiUploads, tmpDir, runner, {
      ingestFn: mockIngestFn as unknown as () => Promise<{ pages: string[] }>,
    })
    expect("taskId" in result).toBe(true)

    const taskId = (result as { taskId: string }).taskId
    await waitForTask(runner, taskId)

    const record = getUpload("upload-3")
    expect(record!.status).toBe("failed")
    expect(record!.ingestError).toContain("LLM 调用失败")
  })
})
