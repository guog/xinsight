import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { readFile, writeFile, unlink, rename, mkdir } from "fs/promises"
import { join, dirname, basename } from "path"
import type { LintIssue } from "./lint"
import { extractText } from "./extract-text"

// 创建 DeepSeek 兼容的 OpenAI provider
const provider = createOpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
})

// 调用 LLM 生成文本
async function callLLM(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: provider("deepseek-chat"),
    prompt,
  })
  return text
}

// 目录到类型的映射
function typeFromDir(filePath: string): string {
  if (filePath.includes("/entities/")) return "entity"
  if (filePath.includes("/concepts/")) return "concept"
  if (filePath.includes("/comparisons/")) return "comparison"
  if (filePath.includes("/queries/")) return "query"
  if (filePath.includes("/summaries/")) return "summary"
  return "entity"
}

// 类型到目录的映射
function dirForType(type: string): string {
  const map: Record<string, string> = {
    entity: "entities",
    concept: "concepts",
    comparison: "comparisons",
    query: "queries",
    summary: "summaries",
  }
  return map[type] || "entities"
}

// 修复缺失的 frontmatter
async function fixStructure(issue: LintIssue, wikiPath: string): Promise<void> {
  const fullPath = join(wikiPath, issue.file)
  const content = await readFile(fullPath, "utf-8")
  const type = typeFromDir(issue.file)
  const now = new Date().toISOString().split("T")[0]

  const prompt = `你是一个 Wiki 编辑助手。请为以下 Markdown 内容生成 YAML frontmatter。
要求：
- title: 从内容推断合适的标题
- tags: 从内容提取 3-5 个相关标签（数组格式）
- created: ${now}
- updated: ${now}
- type: ${type}
- sources: []
- confidence: medium

只返回 frontmatter 块（包含 --- 分隔符），不要返回其他内容。

内容：
${content.slice(0, 2000)}`

  const frontmatter = await callLLM(prompt)
  const newContent = frontmatter.trim() + "\n\n" + content
  await writeFile(fullPath, newContent, "utf-8")
}

// 修复死链接：移除断裂的 [[links]]
async function fixDeadLinks(issue: LintIssue, wikiPath: string): Promise<void> {
  const fullPath = join(wikiPath, issue.file)
  const content = await readFile(fullPath, "utf-8")

  // 从 issue message 中提取死链接目标
  const linkMatch = issue.message.match(/\[\[(.+?)\]\]/)
  if (!linkMatch) return

  const deadLink = linkMatch[1]
  // 将 [[dead-link]] 替换为纯文本
  const fixed = content.replaceAll(`[[${deadLink}]]`, deadLink)
  await writeFile(fullPath, fixed, "utf-8")
}

// 修复重复：删除位置不合适的那个
async function fixDuplicates(issue: LintIssue, wikiPath: string): Promise<void> {
  // issue.details 应包含重复文件路径
  const details = issue.details as { duplicate?: string } | undefined
  const duplicatePath = details?.duplicate
  if (!duplicatePath) return

  const fullPath = join(wikiPath, duplicatePath)
  await unlink(fullPath)
}

// 修复质量问题：用 LLM 扩写
async function fixQuality(issue: LintIssue, wikiPath: string): Promise<void> {
  const fullPath = join(wikiPath, issue.file)
  const content = await readFile(fullPath, "utf-8")

  const prompt = `你是 Karpathy 风格的 Wiki 编辑。请将以下过短的 Wiki 页面扩写为高质量内容。

要求：
- 保留原有的 frontmatter 不变
- 使用清晰的 Markdown 结构（标题、列表、代码块等）
- 添加 [[双括号链接]] 指向相关概念
- 教育性语气，深入浅出
- 内容全面，至少 300 字
- 中文撰写

原始内容：
${content}`

  const expanded = await callLLM(prompt)
  await writeFile(fullPath, expanded, "utf-8")
}

// 修复目录问题：移动文件到正确目录
async function fixDirectory(issue: LintIssue, wikiPath: string): Promise<void> {
  const fullPath = join(wikiPath, issue.file)
  const content = await readFile(fullPath, "utf-8")

  // 从 frontmatter 提取 type
  const typeMatch = content.match(/^type:\s*(.+)$/m)
  if (!typeMatch) return

  const type = typeMatch[1].trim().replace(/['"]/g, "")
  const targetDir = dirForType(type)
  const fileName = basename(issue.file)
  const targetPath = join(wikiPath, targetDir, fileName)

  await mkdir(dirname(targetPath), { recursive: true })
  await rename(fullPath, targetPath)
}

// 修复上传完整性：重新提取文本
async function fixUploadIntegrity(issue: LintIssue, wikiPath: string): Promise<void> {
  const details = issue.details as { sourcePath?: string } | undefined
  const sourcePath = details?.sourcePath
  if (!sourcePath) return

  const fullSourcePath = join(wikiPath, sourcePath)
  const result = await extractText(fullSourcePath)
  const targetPath = join(wikiPath, issue.file)
  await writeFile(targetPath, result, "utf-8")
}

// 主函数：自动修复所有可修复的问题
export async function autoFixIssues(
  issues: LintIssue[],
  wikiPath: string,
  options?: {
    signal?: AbortSignal
    onProgress?: (current: number, total: number, file: string) => void
  },
): Promise<{ fixed: number; skipped: number; errors: string[] }> {
  const fixableIssues = issues.filter((i) => i.autoFixable)
  const total = fixableIssues.length
  let fixed = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < fixableIssues.length; i++) {
    // 检查是否被中止
    options?.signal?.throwIfAborted()

    const issue = fixableIssues[i]
    options?.onProgress?.(i + 1, total, issue.file)

    try {
      switch (issue.category) {
        case "structure":
          await fixStructure(issue, wikiPath)
          break
        case "dead-links":
          await fixDeadLinks(issue, wikiPath)
          break
        case "duplicates":
          await fixDuplicates(issue, wikiPath)
          break
        case "quality":
          await fixQuality(issue, wikiPath)
          break
        case "directory":
          await fixDirectory(issue, wikiPath)
          break
        case "upload-integrity":
          await fixUploadIntegrity(issue, wikiPath)
          break
        default:
          skipped++
          continue
      }
      fixed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`[${issue.file}] ${issue.category}: ${msg}`)
      skipped++
    }
  }

  return { fixed, skipped, errors }
}
