import { createTool } from "@mastra/core/tools"
import * as z from "zod"
import { readdir, readFile } from "fs/promises"
import { join, relative, resolve } from "path"

const getWikiPath = () => process.env.WIKI_PATH || join(process.cwd(), "wiki")

/** 安全路径解析：确保解析后的路径在 basePath 目录内，防止路径遍历 */
function safePath(basePath: string, relativePath: string): string | null {
  const base = resolve(basePath) + "/"
  const resolved = resolve(basePath, relativePath)
  if (!resolved.startsWith(base) && resolved !== resolve(basePath)) return null
  return resolved
}

/** 递归查找目录下的所有 markdown 文件（返回相对于 basePath 的路径） */
async function scanFilesRecursively(dir: string, basePath: string): Promise<string[]> {
  const results: string[] = []
  let entries: any[] = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await scanFilesRecursively(fullPath, basePath)))
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      results.push(relative(basePath, fullPath))
    }
  }
  return results
}

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
  execute: async ({ query, type, limit }, context) => {
    const { db } = await import("@/db")
    const { wikiNamespaces, agentWikiNamespaces } = await import("@/db/schema")
    const { eq } = await import("drizzle-orm")

    const maxResults = limit ?? 5
    const results: Array<{
      path: string
      title: string
      type: string
      snippet: string
      tags: string[]
    }> = []

    const ctx = context as unknown as {
      agentId?: string
      resourceId?: string
      agent?: { agentId?: string; resourceId?: string }
    }
    const agentId = ctx.agent?.agentId ?? ctx.agent?.resourceId ?? ctx.agentId ?? ctx.resourceId

    // 1. 获取该 Agent 的挂载分区
    let namespaces: string[] = []
    if (agentId) {
      try {
        const rows = await db
          .select({ name: wikiNamespaces.name })
          .from(agentWikiNamespaces)
          .innerJoin(wikiNamespaces, eq(agentWikiNamespaces.namespaceId, wikiNamespaces.id))
          .where(eq(agentWikiNamespaces.agentId, agentId))
          .all()
        namespaces = rows.map((r) => r.name)
      } catch (e) {
        console.error("查询 Agent 分区绑定失败", e)
      }
    }

    // 2. 获取所有已注册的分区名称，用于排除公共扫描
    let allRegisteredNamespaces: string[] = []
    try {
      const allNss = await db.select({ name: wikiNamespaces.name }).from(wikiNamespaces).all()
      allRegisteredNamespaces = allNss.map((r) => r.name)
    } catch {
      // ignored
    }

    // 3. 收集所有可供扫描的相对路径
    const relativePaths: string[] = []
    const wikiRoot = getWikiPath()

    if (agentId) {
      if (namespaces.length > 0) {
        // 只扫描该 Agent 挂载的分区文件夹
        for (const ns of namespaces) {
          const nsPath = join(wikiRoot, ns)
          relativePaths.push(...(await scanFilesRecursively(nsPath, wikiRoot)))
        }
      } else {
        // 扫描公共非分区页面
        const topEntries = await readdir(wikiRoot, { withFileTypes: true }).catch(() => [])
        for (const entry of topEntries) {
          const entryPath = join(wikiRoot, entry.name)
          if (entry.isDirectory()) {
            if (!allRegisteredNamespaces.includes(entry.name)) {
              relativePaths.push(...(await scanFilesRecursively(entryPath, wikiRoot)))
            }
          } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
            relativePaths.push(entry.name)
          }
        }
      }
    } else {
      // agentId 缺失，允许扫描全部
      relativePaths.push(...(await scanFilesRecursively(wikiRoot, wikiRoot)))
    }

    // 4. 进行关键词匹配和打分
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(Boolean)

    for (const relPath of relativePaths) {
      // 路径安全校验
      const fullPath = safePath(wikiRoot, relPath)
      if (!fullPath) continue

      let content: string
      try {
        content = await readFile(fullPath, "utf-8")
      } catch {
        continue
      }

      let score = 0
      for (const term of queryTerms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const regex = new RegExp(escaped, "gi")
        const matches = content.match(regex)
        if (matches) score += matches.length
      }

      if (score === 0) continue

      const meta = parseFrontmatter(content)
      const snippet = extractSnippet(content, queryTerms)
      // 计算文件的类别（type）：如果是分区下的，取分区名作为 type，否则取第一级子文件夹名
      let computedType = "page"
      const pathParts = relPath.split("/")
      if (pathParts.length > 1) {
        computedType = pathParts[0]
      }

      results.push({
        path: relPath,
        title: meta.title || pathParts[pathParts.length - 1].replace(/\.mdx?$/, ""),
        type: meta.type || computedType,
        snippet,
        tags: meta.tags || [],
      })
    }

    // 按相关度排序
    results.sort((a, b) => {
      const scoreA = queryTerms.reduce(
        (s: number, t: string) => s + (a.snippet.toLowerCase().includes(t) ? 1 : 0),
        0,
      )
      const scoreB = queryTerms.reduce(
        (s: number, t: string) => s + (b.snippet.toLowerCase().includes(t) ? 1 : 0),
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
    const fullPath = safePath(getWikiPath(), pagePath)
    if (!fullPath) {
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
        const fullPath = safePath(getWikiPath(), page.path)
        if (!fullPath) continue

        // 只允许 .md 文件
        if (!fullPath.endsWith(".md")) continue

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

/**
 * wiki-list — 读取 index.md 目录
 */
export const wikiListTool = createTool({
  id: "wiki-list",
  description:
    "读取知识库的 index.md 目录，获取所有页面的概览。" +
    "这是问答的第一步：先了解知识库有哪些内容，再决定读取哪些页面。",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (_, context) => {
    const { db } = await import("@/db")
    const { wikiNamespaces, agentWikiNamespaces } = await import("@/db/schema")
    const { eq } = await import("drizzle-orm")

    const ctx = context as unknown as {
      agentId?: string
      resourceId?: string
      agent?: { agentId?: string; resourceId?: string }
    }
    const agentId = ctx.agent?.agentId ?? ctx.agent?.resourceId ?? ctx.agentId ?? ctx.resourceId

    const wikiRoot = getWikiPath()

    // 1. 获取该 Agent 的挂载分区
    let namespaces: string[] = []
    if (agentId) {
      try {
        const rows = await db
          .select({ name: wikiNamespaces.name })
          .from(agentWikiNamespaces)
          .innerJoin(wikiNamespaces, eq(agentWikiNamespaces.namespaceId, wikiNamespaces.id))
          .where(eq(agentWikiNamespaces.agentId, agentId))
          .all()
        namespaces = rows.map((r) => r.name)
      } catch {
        // ignored
      }
    }

    if (agentId && namespaces.length > 0) {
      // 聚合挂载分区的 index.md 或动态生成
      let aggregatedContent = ""
      for (const ns of namespaces) {
        const nsIndex = join(wikiRoot, ns, "index.md")
        let nsContent = ""
        try {
          nsContent = await readFile(nsIndex, "utf-8")
        } catch {
          // 动态生成目录列表
          const files = await scanFilesRecursively(join(wikiRoot, ns), wikiRoot)
          if (files.length > 0) {
            nsContent =
              `# ${ns} 分区文档目录\n\n` +
              files
                .map((f) => `- [${f.replace(ns + "/", "").replace(/\.mdx?$/, "")}](${f})`)
                .join("\n") +
              "\n"
          } else {
            nsContent = `# ${ns} 分区文档目录\n\n暂无文档\n`
          }
        }
        aggregatedContent += nsContent + "\n---\n\n"
      }
      return { success: true, content: aggregatedContent.trim() }
    }

    if (agentId) {
      // 有 Agent 但未绑定分区，只列出公共文档
      let allRegisteredNamespaces: string[] = []
      try {
        const allNss = await db.select({ name: wikiNamespaces.name }).from(wikiNamespaces).all()
        allRegisteredNamespaces = allNss.map((r) => r.name)
      } catch {
        // ignored
      }

      const publicFiles: string[] = []
      const topEntries = await readdir(wikiRoot, { withFileTypes: true }).catch(() => [])
      for (const entry of topEntries) {
        const entryPath = join(wikiRoot, entry.name)
        if (entry.isDirectory()) {
          if (!allRegisteredNamespaces.includes(entry.name)) {
            publicFiles.push(...(await scanFilesRecursively(entryPath, wikiRoot)))
          }
        } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
          publicFiles.push(entry.name)
        }
      }

      let content = "# 公共文档目录\n\n"
      if (publicFiles.length > 0) {
        content += publicFiles.map((f) => `- [${f.replace(/\.mdx?$/, "")}](${f})`).join("\n")
      } else {
        content += "暂无公共文档"
      }
      return { success: true, content }
    }

    // 默认回退（无 agentId）
    try {
      const indexPath = join(wikiRoot, "index.md")
      const content = await readFile(indexPath, "utf-8")
      return { success: true, content }
    } catch {
      return { success: false, error: "index.md 不存在" }
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
