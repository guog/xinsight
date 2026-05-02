import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq } from "drizzle-orm"
import { wikiUploads } from "@/db/schema"
import { startupScan } from "../startup-scan"

// 临时目录
const tmpDir = join(import.meta.dir, "__tmp_startup_scan__")

function setupDb() {
  const sqlite = new Database(":memory:")
  sqlite.run(`CREATE TABLE wiki_uploads (
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
  )`)
  const db = drizzle(sqlite)
  return { db, sqlite }
}

function insertUpload(sqlite: Database, overrides: Partial<Record<string, unknown>> = {}) {
  const defaults = {
    id: crypto.randomUUID(),
    original_name: "test.pdf",
    stored_path: "test.pdf",
    mime_type: "application/pdf",
    size: 100,
    sha256: crypto.randomUUID(),
    status: "pending",
    source: "upload",
    uploaded_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    ingest_progress: 0,
  }
  const row = { ...defaults, ...overrides }
  sqlite.run(
    `INSERT INTO wiki_uploads (id, original_name, stored_path, mime_type, size, sha256, status, source, uploaded_at, created_at, updated_at, ingest_progress)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.original_name,
      row.stored_path,
      row.mime_type,
      row.size,
      row.sha256,
      row.status,
      row.source,
      row.uploaded_at,
      row.created_at,
      row.updated_at,
      row.ingest_progress,
    ],
  )
  return row
}

describe("startupScan", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("空目录返回 { newFiles: 0, skipped: 0 }", async () => {
    const { db } = setupDb()
    const result = await startupScan(tmpDir, db, wikiUploads)
    expect(result).toEqual({ newFiles: 0, skipped: 0 })
  })

  it("已注册文件被跳过", async () => {
    const { db, sqlite } = setupDb()
    writeFileSync(join(tmpDir, "existing.pdf"), "data")
    insertUpload(sqlite, { stored_path: "raw/uploads/existing.pdf" })
    const result = await startupScan(tmpDir, db, wikiUploads)
    expect(result).toEqual({ newFiles: 0, skipped: 1 })
  })

  it("未注册文件计入 newFiles", async () => {
    const { db } = setupDb()
    writeFileSync(join(tmpDir, "new-file.pdf"), "data")
    const result = await startupScan(tmpDir, db, wikiUploads)
    expect(result).toEqual({ newFiles: 1, skipped: 0 })
  })

  it("ingesting 状态记录被重置为 pending", async () => {
    const { db, sqlite } = setupDb()
    writeFileSync(join(tmpDir, "stuck.pdf"), "data")
    insertUpload(sqlite, { stored_path: "raw/uploads/stuck.pdf", status: "ingesting" })
    const result = await startupScan(tmpDir, db, wikiUploads)
    expect(result).toEqual({ newFiles: 0, skipped: 1 })
    // 验证状态已重置
    const rows = db
      .select()
      .from(wikiUploads)
      .where(eq(wikiUploads.storedPath, "raw/uploads/stuck.pdf"))
      .all()
    expect(rows[0].status).toBe("pending")
  })

  it("忽略 .extracted.md、.registry.json、.DS_Store、.tmp 文件", async () => {
    const { db } = setupDb()
    writeFileSync(join(tmpDir, ".registry.json"), "{}")
    writeFileSync(join(tmpDir, "doc.extracted.md"), "md")
    writeFileSync(join(tmpDir, ".DS_Store"), "")
    writeFileSync(join(tmpDir, "temp.tmp"), "")
    writeFileSync(join(tmpDir, "real.pdf"), "pdf")
    const result = await startupScan(tmpDir, db, wikiUploads)
    expect(result).toEqual({ newFiles: 1, skipped: 0 })
  })
})
