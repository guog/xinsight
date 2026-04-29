// 自动摄入管线：上传 → 提取 → 写入 wiki
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join, relative, basename } from "path"
import { createHash } from "crypto"
import { glob } from "glob"

// DeepSeek LLM 配置（与 auto-fix.ts 一致）
const provider = createOpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
})

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

interface PageSpec {
  title: string
  tags: string[]
  type: string // entities, concepts, notes, references 等
  content: string
}

// 使用 LLM 将提取的 markdown 拆分为 wiki 页面（Karpathy 风格）
async function splitIntoPages(markdown: string, signal?: AbortSignal): Promise<PageSpec[]> {
  const { text } = await generateText({
    model: provider("deepseek-chat"),
    abortSignal: signal,
    system: `你是一个知识整理专家。将输入的 markdown 文档拆分为多个独立的 wiki 页面，采用 Karpathy 风格（简洁、清晰、信息密度高）。

每个页面输出为 JSON 对象，包含：
- title: 页面标题
- tags: 相关标签数组
- type: 分类目录，只能是以下之一：entities, concepts, notes, references
- content: 页面正文（markdown 格式，不含 frontmatter）

输出一个 JSON 数组，不要输出其他内容。`,
    prompt: markdown,
  })

  try {
    // 提取 JSON（可能包裹在代码块中）
    const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "")
    return JSON.parse(jsonStr)
  } catch {
    // 降级：整个文档作为一个页面
    return [
      {
        title: "未分类文档",
        tags: [],
        type: "notes",
        content: markdown,
      },
    ]
  }
}

// 生成 frontmatter
function makeFrontmatter(page: PageSpec, sourceSha256: string): string {
  const contentHash = sha256(page.content)
  return `---
title: "${page.title}"
tags: [${page.tags.map((t) => `"${t}"`).join(", ")}]
type: ${page.type}
created: "${new Date().toISOString()}"
sha256: "${contentHash}"
source_sha256: "${sourceSha256}"
---

${page.content}
`
}

// 文件名安全化
function safeFilename(title: string): string {
  return title
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80)
}

/**
 * 摄入单个已提取的 markdown 文件到 wiki
 */
export async function ingestFile(
  extractedMdPath: string,
  wikiPath: string,
  options?: { signal?: AbortSignal },
): Promise<{ pages: string[] }> {
  const markdown = await readFile(extractedMdPath, "utf-8")
  const sourceSha = sha256(markdown)
  const pages = await splitIntoPages(markdown, options?.signal)
  const createdPaths: string[] = []

  for (const page of pages) {
    const dir = join(wikiPath, page.type)
    await mkdir(dir, { recursive: true })
    const filename = `${safeFilename(page.title)}.md`
    const filePath = join(dir, filename)
    const content = makeFrontmatter(page, sourceSha)
    await writeFile(filePath, content, "utf-8")
    createdPaths.push(relative(wikiPath, filePath))
  }

  return { pages: createdPaths }
}

/**
 * 批量摄入所有已提取的文件
 */
export async function ingestAll(
  wikiPath: string,
  options?: {
    signal?: AbortSignal
    onProgress?: (current: number, total: number, file: string) => void
  },
): Promise<{ totalPages: number; files: number }> {
  // 查找所有 .extracted.md 文件
  const pattern = join(wikiPath, "raw/uploads/**/*.extracted.md")
  const files = await glob(pattern)

  if (files.length === 0) return { totalPages: 0, files: 0 }

  // 收集已有页面的 source_sha256
  const existingShas = new Set<string>()
  const wikiFiles = await glob(join(wikiPath, "{entities,concepts,notes,references}/**/*.md"))
  for (const f of wikiFiles) {
    const content = await readFile(f, "utf-8")
    const match = content.match(/source_sha256:\s*"([a-f0-9]+)"/)
    if (match) existingShas.add(match[1])
  }

  let totalPages = 0
  let processedFiles = 0

  for (let i = 0; i < files.length; i++) {
    if (options?.signal?.aborted) break

    const file = files[i]
    const markdown = await readFile(file, "utf-8")
    const fileSha = sha256(markdown)

    // 跳过已摄入的文件
    if (existingShas.has(fileSha)) continue

    options?.onProgress?.(i + 1, files.length, basename(file))

    const result = await ingestFile(file, wikiPath, { signal: options?.signal })
    totalPages += result.pages.length
    processedFiles++
  }

  return { totalPages, files: processedFiles }
}
