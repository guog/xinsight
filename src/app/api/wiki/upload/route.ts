import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/auth"
import { extractText } from "@/lib/wiki/extract-text"

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
  const session = await getSession()
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

    // 生成存储文件名（保留原始扩展名）
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : ""
    const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
    const storedPath = join(UPLOAD_DIR, storedName)

    // 写入文件
    const buffer = Buffer.from(await file.arrayBuffer())
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

    const result = {
      id: randomUUID(),
      originalName: file.name,
      storedPath: `raw/uploads/${storedName}`,
      extractedPath: extractedText ? `raw/uploads/${storedName}.extracted.md` : undefined,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      hasText: !!extractedText,
      uploadedAt: new Date().toISOString(),
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("文件上传失败:", err)
    return NextResponse.json({ error: "文件上传失败" }, { status: 500 })
  }
}
