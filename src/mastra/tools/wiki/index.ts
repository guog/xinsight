import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { readdir, readFile } from "fs/promises"
import { join, relative } from "path"

const getWikiPath = () => process.env.WIKI_PATH || join(process.cwd(), "wiki")

/**
 * wiki-search — 在知识库中搜索相关内容
 */
export const wikiSearchTool = createTool({
  id: "wiki-search",
  description:
    "在知识库（wiki）中搜索相关背景知识。" +
    "可搜索实体、概念、文档内容。返回匹配的页面摘要。" +
    "适用于：查找业务术语定义、设备说明、工艺流程、历史分析等。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词或短语"),
    type: z
      .enum(["all", "entity", "concept", "comparison", "query"])
      .optional()
      .describe("限定搜索的页面类型"),
    limit: z.number().optional().default(5).describe("最大返回结果数"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        path: z.string(),
        title: z.string(),
        type: z.string(),
        snippet: z.string(),
        tags: z.array(z.string()),
      }),
    ),
    total: z.number(),
  }),
  execute: async ({ query, type, limit }) => {
    const maxResults = limit ?? 5
    const results: Array<{
      path: string
      title: string
      type: string
      snippet: string
      tags: string[]
    }> = []

    // 确定搜索目录
    const searchDirs =
      type && type !== "all"
        ? [
            type === "entity"
              ? "entities"
              : type === "concept"
                ? "concepts"
                : type === "comparison"
                  ? "comparisons"
                  : "queries",
          ]
        : ["entities", "concepts", "comparisons", "queries"]

    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(Boolean)

    for (const dir of searchDirs) {
      const dirPath = join(getWikiPath(), dir)
      let files: string[]
      try {
        files = await readdir(dirPath)
      } catch {
        continue
      }

      for (const file of files) {
        if (!file.endsWith(".md") || file.startsWith(".")) continue

        const filePath = join(dirPath, file)
        let content: string
        try {
          content = await readFile(filePath, "utf-8")
        } catch {
          continue
        }

        // 计算匹配度 — 简单的 term frequency 评分
        let score = 0
        for (const term of queryTerms) {
          const regex = new RegExp(term, "gi")
          const matches = content.match(regex)
          if (matches) score += matches.length
        }

        if (score === 0) continue

        // 解析 frontmatter
        const meta = parseFrontmatter(content)
        // 提取匹配行作为摘要
        const snippet = extractSnippet(content, queryTerms)

        results.push({
          path: relative(getWikiPath(), filePath),
          title: meta.title || file.replace(".md", ""),
          type: meta.type || dir.replace(/s$/, ""),
          snippet,
          tags: meta.tags || [],
        })
      }
    }

    // 按相关度排序
    results.sort((a, b) => {
      const scoreA = queryTerms.reduce(
        (s, t) => s + (a.snippet.toLowerCase().includes(t) ? 1 : 0),
        0,
      )
      const scoreB = queryTerms.reduce(
        (s, t) => s + (b.snippet.toLowerCase().includes(t) ? 1 : 0),
        0,
      )
      return scoreB - scoreA
    })

    return {
      results: results.slice(0, maxResults),
      total: results.length,
    }
  },
})

/**
 * wiki-read — 读取 wiki 页面完整内容
 */
export const wikiReadTool = createTool({
  id: "wiki-read",
  description:
    "读取知识库中指定页面的完整内容。" +
    "先用 wiki-search 找到相关页面路径，再用此工具读取详细内容。",
  inputSchema: z.object({
    path: z.string().describe("wiki 内的相对路径，如 entities/production-line.md"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ path: pagePath }) => {
    const fullPath = join(getWikiPath(), pagePath)
    // 安全检查 — 防止路径遍历
    if (!fullPath.startsWith(getWikiPath())) {
      return { success: false, error: "路径不合法" }
    }
    try {
      const content = await readFile(fullPath, "utf-8")
      return { success: true, content }
    } catch {
      return { success: false, error: `页面 "${pagePath}" 不存在` }
    }
  },
})

/**
 * wiki-ingest — 将上传的原始文件解析为结构化 wiki 页面
 */
export const wikiIngestTool = createTool({
  id: "wiki-ingest",
  description:
    "将上传到 raw/uploads/ 的文件内容解析并整合到知识库中。" +
    "Agent 应阅读文件内容，识别实体和概念，创建或更新对应的 wiki 页面。" +
    "返回 ingest 操作的结果摘要。",
  inputSchema: z.object({
    filePath: z.string().describe("raw/uploads/ 下的文件路径"),
    pages: z
      .array(
        z.object({
          path: z.string().describe("目标 wiki 页面路径，如 entities/plc-controller.md"),
          content: z.string().describe("页面完整 markdown 内容（含 frontmatter）"),
        }),
      )
      .describe("要创建或更新的 wiki 页面列表"),
    indexEntries: z.array(z.string()).optional().describe("要追加到 index.md 的条目"),
    logEntry: z.string().optional().describe("追加到 log.md 的日志条目"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    pagesCreated: z.number(),
    pagesUpdated: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ pages, indexEntries, logEntry }) => {
    const { writeFile, appendFile, access } = await import("fs/promises")
    const { dirname } = await import("path")
    const { mkdirSync } = await import("fs")

    let created = 0
    let updated = 0

    try {
      for (const page of pages) {
        const fullPath = join(getWikiPath(), page.path)
        if (!fullPath.startsWith(getWikiPath())) continue

        // 确保目录存在
        const dir = dirname(fullPath)
        try {
          mkdirSync(dir, { recursive: true })
        } catch {
          /* exists */
        }

        // 判断是创建还是更新
        let isUpdate = false
        try {
          await access(fullPath)
          isUpdate = true
        } catch {
          /* not exists */
        }

        await writeFile(fullPath, page.content, "utf-8")
        if (isUpdate) updated++
        else created++
      }

      // 更新 index.md
      if (indexEntries?.length) {
        const indexPath = join(getWikiPath(), "index.md")
        const entries = "\n" + indexEntries.join("\n") + "\n"
        await appendFile(indexPath, entries, "utf-8")
      }

      // 更新 log.md
      if (logEntry) {
        const logPath = join(getWikiPath(), "log.md")
        await appendFile(logPath, "\n" + logEntry + "\n", "utf-8")
      }

      return { success: true, pagesCreated: created, pagesUpdated: updated }
    } catch (err) {
      return { success: false, pagesCreated: created, pagesUpdated: updated, error: String(err) }
    }
  },
})

// 辅助函数：解析 YAML frontmatter
function parseFrontmatter(content: string): { title?: string; type?: string; tags?: string[] } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml = match[1]
  const title = yaml.match(/title:\s*(.+)/)?.[1]?.trim()
  const type = yaml.match(/type:\s*(.+)/)?.[1]?.trim()
  const tagsMatch = yaml.match(/tags:\s*\[([^\]]*)\]/)
  const tags = tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()) : []

  return { title, type, tags }
}

// 辅助函数：提取包含关键词的摘要片段
function extractSnippet(content: string, terms: string[]): string {
  // 去除 frontmatter
  const body = content.replace(/^---[\s\S]*?---\n?/, "")
  const lines = body.split("\n").filter((l) => l.trim())

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (terms.some((t) => lower.includes(t))) {
      return line.slice(0, 200)
    }
  }

  // 无匹配行则返回前 200 字符
  return body.slice(0, 200)
}
