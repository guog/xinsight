/**
 * 知识库 LLM Ingest 脚本
 * 对 wiki/knowledge/ 中的提取文件运行 splitIntoPages → 生成结构化页面
 * 大文件自动分块（每块 ~30K chars）
 */
import { readFile, writeFile, mkdir, readdir, appendFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const WIKI_PATH = join(import.meta.dir, "../wiki")
const KNOWLEDGE_PATH = join(WIKI_PATH, "knowledge")
const MAX_CHUNK_SIZE = 30_000 // chars per LLM call
const LOG_PATH = join(WIKI_PATH, "log.md")

const provider = createOpenAICompatible({
  name: "deepseek",
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
})

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function safeFilename(title: string): string {
  return title
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80)
}

interface PageSpec {
  title: string
  tags: string[]
  type: string
  content: string
}

// 按段落边界分块
function chunkMarkdown(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text]

  const chunks: string[] = []
  const paragraphs = text.split(/\n(?=#{1,3}\s)/) // 按标题分割

  let current = ""
  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push(current)
      current = para
    } else {
      current += (current ? "\n" : "") + para
    }
  }
  if (current) chunks.push(current)

  // 如果某块仍然太大，强制按字数切
  const result: string[] = []
  for (const chunk of chunks) {
    if (chunk.length <= maxSize) {
      result.push(chunk)
    } else {
      for (let i = 0; i < chunk.length; i += maxSize) {
        result.push(chunk.slice(i, i + maxSize))
      }
    }
  }
  return result
}

async function splitIntoPages(markdown: string, sourceFile: string): Promise<PageSpec[]> {
  const { text } = await generateText({
    model: provider.chatModel("deepseek-chat"),
    system: `你是一个知识整理专家。将输入的 markdown 文档拆分为多个独立的 wiki 页面。

每个页面输出为 JSON 对象：
- title: 简洁的页面标题（中文）
- tags: 相关标签数组（英文小写）
- type: 只能是: entities, concepts, notes, references
- content: 页面正文（markdown 格式，保留关键信息，去除冗余格式）

规则：
1. 一个独立概念/系统/流程 = 一个页面
2. 标题要有区分度，例如"WMS入库流程"而非"入库"
3. 保留具体数据（型号、参数、规格）
4. 页面粒度：3000-8000字符为佳

输出纯 JSON 数组，不要包裹代码块。`,
    prompt: markdown,
    maxOutputTokens: 8000,
  })

  try {
    const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "")
    const pages = JSON.parse(jsonStr)
    if (Array.isArray(pages)) return pages
    return [pages]
  } catch (_e) {
    return [
      {
        title: sourceFile.replace(/\.md$/, ""),
        tags: [],
        type: "notes",
        content: markdown.slice(0, 8000),
      },
    ]
  }
}

function makeFrontmatter(page: PageSpec, sourceSha: string): string {
  return `---
title: "${page.title}"
tags: [${page.tags.map((t) => `"${t}"`).join(", ")}]
type: ${page.type}
created: "${new Date().toISOString()}"
sha256: "${sha256(page.content)}"
source_sha256: "${sourceSha}"
---

${page.content}
`
}

async function main() {
  console.log("🚀 Wiki LLM Ingest 开始\n")

  const files = (await readdir(KNOWLEDGE_PATH)).filter((f) => f.endsWith(".md"))
  console.log(`📂 找到 ${files.length} 个文件待处理\n`)

  let totalPages = 0

  for (const file of files) {
    const filePath = join(KNOWLEDGE_PATH, file)
    const content = await readFile(filePath, "utf-8")
    const sourceSha = sha256(content)

    console.log(`📄 处理: ${file} (${content.length} chars)`)

    const chunks = chunkMarkdown(content, MAX_CHUNK_SIZE)
    console.log(`   分为 ${chunks.length} 块`)

    const allPages: PageSpec[] = []

    for (let i = 0; i < chunks.length; i++) {
      console.log(`   → 块 ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`)
      try {
        const pages = await splitIntoPages(chunks[i], file)
        allPages.push(...pages)
        console.log(`     ✅ 生成 ${pages.length} 个页面`)
      } catch (e: unknown) {
        console.error(`     ❌ 失败: ${e instanceof Error ? e.message : e}`)
      }
      // Rate limit: 1s between calls
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 1000))
    }

    // 写入页面文件
    for (const page of allPages) {
      const dir = join(WIKI_PATH, page.type)
      await mkdir(dir, { recursive: true })
      const filename = `${safeFilename(page.title)}.md`
      const filePath = join(dir, filename)
      await writeFile(filePath, makeFrontmatter(page, sourceSha), "utf-8")
    }

    totalPages += allPages.length
    console.log(`   📝 共写入 ${allPages.length} 个页面\n`)

    // 写日志
    const now = new Date().toISOString().slice(0, 19)
    await appendFile(LOG_PATH, `| ${now} | ingest | ${file} | ${allPages.length} pages |\n`)
  }

  console.log(`\n✅ 全部完成！共生成 ${totalPages} 个页面`)
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
