import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq } from "drizzle-orm"
import * as schema from "@/db/schema"

/** 创建内存测试数据库 */
function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
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
    );
    CREATE TABLE wiki_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  return drizzle(sqlite, { schema })
}

describe("wiki_uploads 表", () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  const now = new Date()

  const sampleUpload = {
    id: "upload-1",
    originalName: "测试文档.pdf",
    storedPath: "/uploads/abc123.pdf",
    mimeType: "application/pdf",
    size: 1024,
    sha256: "e3b0c44298fc1c149afbf4c8996fb924",
    status: "pending",
    ingestProgress: 0,
    source: "upload",
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  it("应该能插入并查询记录", async () => {
    await db.insert(schema.wikiUploads).values(sampleUpload)
    const rows = await db.select().from(schema.wikiUploads)
    expect(rows).toHaveLength(1)
    expect(rows[0].originalName).toBe("测试文档.pdf")
    expect(rows[0].status).toBe("pending")
    expect(rows[0].ingestProgress).toBe(0)
  })

  it("应该能更新状态和进度", async () => {
    await db.insert(schema.wikiUploads).values(sampleUpload)
    await db
      .update(schema.wikiUploads)
      .set({ status: "processing", ingestProgress: 50 })
      .where(eq(schema.wikiUploads.id, "upload-1"))
    const [row] = await db
      .select()
      .from(schema.wikiUploads)
      .where(eq(schema.wikiUploads.id, "upload-1"))
    expect(row.status).toBe("processing")
    expect(row.ingestProgress).toBe(50)
  })

  it("应该能删除记录", async () => {
    await db.insert(schema.wikiUploads).values(sampleUpload)
    await db.delete(schema.wikiUploads).where(eq(schema.wikiUploads.id, "upload-1"))
    const rows = await db.select().from(schema.wikiUploads)
    expect(rows).toHaveLength(0)
  })

  it("storedPath 唯一约束应生效", async () => {
    await db.insert(schema.wikiUploads).values(sampleUpload)
    const dup = { ...sampleUpload, id: "upload-2", sha256: "different-hash" }
    expect(() =>
      // bun:sqlite 同步抛出
      db.insert(schema.wikiUploads).values(dup).run(),
    ).toThrow()
  })

  it("sha256 唯一约束应生效", async () => {
    await db.insert(schema.wikiUploads).values(sampleUpload)
    const dup = {
      ...sampleUpload,
      id: "upload-3",
      storedPath: "/uploads/different.pdf",
    }
    expect(() => db.insert(schema.wikiUploads).values(dup).run()).toThrow()
  })

  it("可选字段应允许 null", async () => {
    await db.insert(schema.wikiUploads).values(sampleUpload)
    const [row] = await db.select().from(schema.wikiUploads)
    expect(row.ingestTaskId).toBeNull()
    expect(row.ingestError).toBeNull()
    expect(row.invalidReason).toBeNull()
    expect(row.pagesCreated).toBeNull()
    expect(row.ingestedAt).toBeNull()
  })
})

describe("wiki_settings 表", () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it("应该能插入并查询键值对", async () => {
    await db.insert(schema.wikiSettings).values({ key: "ingest_model", value: "gpt-4o" })
    const rows = await db.select().from(schema.wikiSettings)
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe("ingest_model")
    expect(rows[0].value).toBe("gpt-4o")
  })

  it("应该能更新值", async () => {
    await db.insert(schema.wikiSettings).values({ key: "max_file_size", value: "10485760" })
    await db
      .update(schema.wikiSettings)
      .set({ value: "20971520" })
      .where(eq(schema.wikiSettings.key, "max_file_size"))
    const [row] = await db
      .select()
      .from(schema.wikiSettings)
      .where(eq(schema.wikiSettings.key, "max_file_size"))
    expect(row.value).toBe("20971520")
  })

  it("应该能删除键值对", async () => {
    await db.insert(schema.wikiSettings).values({ key: "temp_key", value: "temp" })
    await db.delete(schema.wikiSettings).where(eq(schema.wikiSettings.key, "temp_key"))
    const rows = await db.select().from(schema.wikiSettings)
    expect(rows).toHaveLength(0)
  })

  it("主键冲突应抛错", async () => {
    await db.insert(schema.wikiSettings).values({ key: "dup_key", value: "v1" })
    expect(() =>
      db.insert(schema.wikiSettings).values({ key: "dup_key", value: "v2" }).run(),
    ).toThrow()
  })
})
