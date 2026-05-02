import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID, createHash } from "crypto"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { extractText } from "@/lib/wiki/extract-text"
import { triggerIngest } from "@/lib/wiki/ingest-pipeline"
import { taskRunner } from "@/lib/wiki/task-runner"
import { db } from "@/db"
import { wikiUploads, wikiSettings } from "@/db/schema"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")
const UPLOAD_DIR = join(WIKI_PATH, "raw", "uploads")
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// 支持的文件类型
const ALLOWED_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
])

export async function POST(request: NextRequest) {
  const session = await getCurrentUser()
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "未提供文件" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "文件大小超过 10MB 限制" }, { status: 400 })
    }

    if (
      !ALLOWED_TYPES.has(file.type) &&
      !file.name.endsWith(".md") &&
      !file.name.endsWith(".txt") &&
      !file.name.endsWith(".csv")
    ) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}。支持: txt, csv, md, json, pdf, xlsx, docx` },
        { status: 400 },
      )
    }

    // 确保上传目录存在
    await mkdir(UPLOAD_DIR, { recursive: true })

    // SHA256 去重检查
    const buffer = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash("sha256").update(buffer).digest("hex")

    const existing = db
      .select({ id: wikiUploads.id, originalName: wikiUploads.originalName })
      .from(wikiUploads)
      .where(eq(wikiUploads.sha256, sha256))
      .all()

    if (existing.length > 0) {
      return NextResponse.json(
        {
          duplicate: true,
          message: `文件内容与已上传的「${existing[0].originalName}」重复`,
          duplicateOf: existing[0],
        },
        { status: 409 },
      )
    }

    // 生成存储文件名（保留原始扩展名）
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : ""
    const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
    const storedPath = join(UPLOAD_DIR, storedName)

    // 写入文件
    await writeFile(storedPath, buffer)

    // 提取文本内容并保存为 .extracted.md
    let extractedText: string | undefined
    const extraction = await extractText(storedPath)
    if (extraction.text) {
      extractedText = extraction.text
      const extractedPath = storedPath + ".extracted.md"
      await writeFile(
        extractedPath,
        `---\nsource: ${file.name}\nextracted: ${new Date().toISOString()}\n---\n\n${extraction.text}`,
      )
    }

    const now = new Date()
    const id = randomUUID()
    const relStoredPath = `raw/uploads/${storedName}`

    // 插入 wikiUploads 记录
    db.insert(wikiUploads)
      .values({
        id,
        originalName: file.name,
        storedPath: relStoredPath,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        sha256,
        status: "pending",
        source: "upload",
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    const result = {
      id,
      originalName: file.name,
      storedPath: relStoredPath,
      extractedPath: extractedText ? `raw/uploads/${storedName}.extracted.md` : undefined,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      hasText: !!extractedText,
      uploadedAt: now.toISOString(),
    }

    // 自动摄入：查询 wikiSettings 是否开启 autoIngest
    if (extractedText) {
      const settings = db
        .select({ value: wikiSettings.value })
        .from(wikiSettings)
        .where(eq(wikiSettings.key, "autoIngest"))
        .all()

      if (settings.length > 0 && settings[0].value === "true") {
        triggerIngest(id, db, wikiUploads, WIKI_PATH, taskRunner)
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("文件上传失败:", err)
    return NextResponse.json({ error: "文件上传失败" }, { status: 500 })
  }
}
