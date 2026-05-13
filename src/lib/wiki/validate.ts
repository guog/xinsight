// 统一验证管道模块
// 对上传/监听/扫描的文件进行校验、去重、提取文本并注册到数据库
import { stat, writeFile } from "fs/promises"
import { basename, extname } from "path"
import { createHash } from "crypto"
import { eq } from "drizzle-orm"
import { extractText } from "./extract-text"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = BunSQLiteDatabase<any>

// 允许的文件扩展名白名单
export const ALLOWED_EXTENSIONS = [
  ".md",
  ".txt",
  ".csv",
  ".json",
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".pptx",
]

// MIME 类型映射
const EXT_TO_MIME: Record<string, string> = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

// 最大文件大小 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024

export interface ValidateInput {
  filePath: string
  storedPath: string // raw/uploads/ 下的相对路径
  source: "upload" | "watch" | "scan"
}

export interface ValidateResult {
  success: boolean
  uploadId?: string
  error?: string
  status: "pending" | "invalid"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WikiUploadsTable = any

interface ValidateDeps {
  db: AnyDB
  wikiUploads: WikiUploadsTable
}

/** 计算文件的 SHA256 */
async function computeFileSha256(filePath: string): Promise<string> {
  const file = Bun.file(filePath)
  const buffer = Buffer.from(await file.arrayBuffer())
  return createHash("sha256").update(buffer).digest("hex")
}

/**
 * 验证并注册文件
 * 依赖注入 db 和 wikiUploads 表，方便测试
 */
export async function validateAndRegister(
  input: ValidateInput,
  deps: ValidateDeps,
): Promise<ValidateResult> {
  const { filePath, storedPath, source } = input
  const { db, wikiUploads } = deps
  const now = new Date()
  const originalName = basename(filePath)
  const ext = extname(filePath).toLowerCase()
  const mimeType = EXT_TO_MIME[ext] ?? "application/octet-stream"

  // 辅助：写入失败记录
  const fail = async (reason: string): Promise<ValidateResult> => {
    const id = crypto.randomUUID()
    try {
      await db.insert(wikiUploads).values({
        id,
        originalName,
        storedPath,
        mimeType,
        size: 0,
        sha256: "",
        source,
        status: "invalid",
        invalidReason: reason,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    } catch {
      // 如果 DB 写入也失败（如唯一约束冲突），忽略
    }
    return { success: false, status: "invalid", error: reason }
  }

  // 1. 检查文件是否存在
  let fileSize: number
  try {
    const fileStat = await stat(filePath)
    fileSize = fileStat.size
  } catch {
    return fail("文件不存在或无法访问")
  }

  // 2. 检查扩展名
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return fail(`不支持的文件扩展名: ${ext}`)
  }

  // 3. 检查文件大小
  if (fileSize > MAX_FILE_SIZE) {
    return fail(`文件大小超过限制（${(fileSize / 1024 / 1024).toFixed(1)}MB > 10MB）`)
  }

  // 4. 计算 SHA256
  const sha256 = await computeFileSha256(filePath)

  // 5. 去重检查
  const existing = await db
    .select()
    .from(wikiUploads)
    .where(eq(wikiUploads.sha256, sha256))
    .limit(1)

  if (existing.length > 0) {
    return fail("文件重复（SHA256 已存在）")
  }

  // 6. 提取文本并保存为 .extracted.md
  try {
    const { text } = await extractText(filePath)
    const extractedPath = filePath.replace(/\.[^.]+$/, ".extracted.md")
    await writeFile(extractedPath, text, "utf-8")
  } catch {
    // 提取失败不阻塞，继续注册
  }

  // 7. 插入 wiki_uploads 记录
  const uploadId = crypto.randomUUID()
  await db.insert(wikiUploads).values({
    id: uploadId,
    originalName,
    storedPath,
    mimeType,
    size: fileSize,
    sha256,
    source,
    status: "pending",
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  return { success: true, status: "pending", uploadId }
}
