/**
 * 测试：只 ingest 最小的文件（项目汇报），验证流程
 */
import { readFile, writeFile, mkdir, appendFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const WIKI_PATH = join(import.meta.dir, "../wiki")
const LOG_PATH = join(WIKI_PATH, "log.md")
const TEST_FILE = join(WIKI_PATH, "knowledge/doc_7fffa83ab520_2301西智信息化项目汇报-许成军.md")

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

async function main() {
  const content = await readFile(TEST_FILE, "utf-8")
  const sourceSha = sha256(content)
  console.log(`📄 测试文件: ${content.length} chars`)

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
    prompt: content,
    maxOutputTokens: 8000,
  })

  console.log(`\n🤖 LLM 返回 ${text.length} chars`)
  console.log(`前200字: ${text.slice(0, 200)}`)

  // Parse
  const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "")
  const pages = JSON.parse(jsonStr)
  console.log(`\n✅ 解析成功: ${pages.length} 个页面`)

  for (const page of pages) {
    console.log(
      `  - [${page.type}] ${page.title} (${page.tags.join(", ")}) — ${page.content.length} chars`,
    )
    const dir = join(WIKI_PATH, page.type)
    await mkdir(dir, { recursive: true })
    const filename = `${safeFilename(page.title)}.md`
    const filePath = join(dir, filename)
    const fm = `---
title: "${page.title}"
tags: [${page.tags.map((t: string) => `"${t}"`).join(", ")}]
type: ${page.type}
created: "${new Date().toISOString()}"
sha256: "${sha256(page.content)}"
source_sha256: "${sourceSha}"
---

${page.content}
`
    await writeFile(filePath, fm, "utf-8")
  }

  const now = new Date().toISOString().slice(0, 19)
  await appendFile(LOG_PATH, `| ${now} | ingest | 项目汇报-许成军.md | ${pages.length} pages |\n`)
  console.log("\n✅ 测试通过！页面已写入")
}

main().catch((e) => {
  console.error("❌", e)
  process.exit(1)
})
