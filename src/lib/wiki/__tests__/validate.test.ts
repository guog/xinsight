import { describe, it, expect, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { writeFile, mkdir, stat } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

// 内联定义 wiki_uploads 表结构（与真实 schema.ts 对齐）
export const wikiUploads = sqliteTable("wiki_uploads", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedPath: text("stored_path").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull().unique(),
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

// 建表 SQL（与 drizzle migration 对齐）
const CREATE_TABLE = `
  CREATE TABLE wiki_uploads (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
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

describe("validateAndRegister", () => {
  let db: ReturnType<typeof drizzle>
  let tmpDir: string

  beforeEach(async () => {
    // 创建内存数据库
    const sqlite = new Database(":memory:")
    sqlite.run(CREATE_TABLE)
    db = drizzle(sqlite, { schema: { wikiUploads } })

    // 创建临时目录
    tmpDir = join(tmpdir(), `validate-test-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
  })

  it("拒绝不支持的文件扩展名", async () => {
    const { validateAndRegister } = await import("../validate")
    const filePath = join(tmpDir, "test.exe")
    await writeFile(filePath, "hello")

    const result = await validateAndRegister(
      { filePath, storedPath: "raw/uploads/test.exe", source: "upload" },
      { db, wikiUploads },
    )

    expect(result.success).toBe(false)
    expect(result.status).toBe("invalid")
    expect(result.error).toContain("扩展名")
  })

  it("拒绝超过 10MB 的文件", async () => {
    const { validateAndRegister } = await import("../validate")
    const filePath = join(tmpDir, "big.md")
    // 创建一个 > 10MB 的文件
    const bigContent = Buffer.alloc(10 * 1024 * 1024 + 1, "x")
    await writeFile(filePath, bigContent)

    const result = await validateAndRegister(
      { filePath, storedPath: "raw/uploads/big.md", source: "upload" },
      { db, wikiUploads },
    )

    expect(result.success).toBe(false)
    expect(result.status).toBe("invalid")
    expect(result.error).toContain("大小")
  })

  it("拒绝重复文件（SHA256 已存在）", async () => {
    const { validateAndRegister } = await import("../validate")
    const filePath = join(tmpDir, "dup.md")
    await writeFile(filePath, "duplicate content")

    // 第一次应该成功
    const first = await validateAndRegister(
      { filePath, storedPath: "raw/uploads/dup1.md", source: "upload" },
      { db, wikiUploads },
    )
    expect(first.success).toBe(true)

    // 第二次应该被去重拒绝
    const second = await validateAndRegister(
      { filePath, storedPath: "raw/uploads/dup2.md", source: "upload" },
      { db, wikiUploads },
    )
    expect(second.success).toBe(false)
    expect(second.status).toBe("invalid")
    expect(second.error).toContain("重复")
  })

  it("成功处理有效的 .md 文件", async () => {
    const { validateAndRegister } = await import("../validate")
    const filePath = join(tmpDir, "valid.md")
    await writeFile(filePath, "# Hello World\n\nSome content here.")

    const result = await validateAndRegister(
      { filePath, storedPath: "raw/uploads/valid.md", source: "scan" },
      { db, wikiUploads },
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe("pending")
    expect(result.uploadId).toBeDefined()
  })

  it("成功处理有效的 .txt 文件并生成 .extracted.md", async () => {
    const { validateAndRegister } = await import("../validate")
    const filePath = join(tmpDir, "notes.txt")
    await writeFile(filePath, "Plain text content")

    const result = await validateAndRegister(
      { filePath, storedPath: "raw/uploads/notes.txt", source: "watch" },
      { db, wikiUploads },
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe("pending")

    // 检查 .extracted.md 是否生成
    const extractedPath = filePath.replace(/\.[^.]+$/, ".extracted.md")
    const fileStat = await stat(extractedPath).catch(() => null)
    expect(fileStat).not.toBeNull()
  })

  it("文件不存在时返回错误", async () => {
    const { validateAndRegister } = await import("../validate")
    const filePath = join(tmpDir, "nonexistent.md")

    const result = await validateAndRegister(
      {
        filePath,
        storedPath: "raw/uploads/nonexistent.md",
        source: "upload",
      },
      { db, wikiUploads },
    )

    expect(result.success).toBe(false)
    expect(result.status).toBe("invalid")
    expect(result.error).toContain("不存在")
  })
})
