import { createHash } from "crypto"
import { readFile, readdir } from "fs/promises"
import { join, relative, basename } from "path"

// Wiki Lint 引擎 - 检查 Wiki 文件的结构、链接、质量等问题

export type LintRule = { id: string; name: string; description: string }
export type LintIssue = {
  rule: LintRule
  file: string
  message: string
  severity: "error" | "warning" | "info"
  autoFixable: boolean
  category?: string
  details?: Record<string, unknown>
}
export type LintReport = { issues: LintIssue[]; scannedFiles: number; duration: number }

// 定义7条规则
const RULES: Record<string, LintRule> = {
  structure: {
    id: "structure",
    name: "结构检查",
    description: "每个 .md 文件必须有包含 title、tags、created 的 YAML frontmatter",
  },
  "dead-links": {
    id: "dead-links",
    name: "死链检查",
    description: "[[link]] 引用必须指向已存在的文件",
  },
  "orphan-pages": {
    id: "orphan-pages",
    name: "孤儿页面",
    description: "没有任何其他页面链入的页面",
  },
  duplicates: {
    id: "duplicates",
    name: "重复文件",
    description: "内容完全相同的文件（SHA256 相同）",
  },
  quality: { id: "quality", name: "质量检查", description: "检查空文件、内容过短、无标签等问题" },
  directory: { id: "directory", name: "目录规范", description: "文件必须符合所在目录的 type 要求" },
  "upload-integrity": {
    id: "upload-integrity",
    name: "上传完整性",
    description: "raw/uploads/ 中的文件必须有对应的 .extracted.md",
  },
}

// 目录到 type 的映射
const DIR_TYPE_MAP: Record<string, string> = {
  entities: "entity",
  concepts: "concept",
  comparisons: "comparison",
  queries: "query",
}

// 递归获取所有文件
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await getAllFiles(fullPath)))
      } else {
        files.push(fullPath)
      }
    }
  } catch {
    // 目录不存在则忽略
  }
  return files
}

// 解析 frontmatter
function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const yaml = match[1]
  const result: Record<string, unknown> = {}
  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value: unknown = line.slice(colonIdx + 1).trim()
    // 简单解析数组格式的 tags
    if (key === "tags" && typeof value === "string") {
      if (value.startsWith("[")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/['"]/g, ""))
          .filter(Boolean)
      } else if (value === "" || value === "[]") {
        value = []
      } else {
        value = [value]
      }
    }
    result[key] = value
  }
  return result
}

// 获取 frontmatter 后的正文内容
function getBodyContent(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  if (!match) return content
  return content.slice(match[0].length)
}

// 提取 [[link]] 引用
function extractWikiLinks(content: string): string[] {
  const links: string[] = []
  const regex = /\[\[([^\]]+)\]\]/g
  let m
  while ((m = regex.exec(content)) !== null) {
    links.push(m[1])
  }
  return links
}

export async function lintWiki(
  wikiPath: string,
  options?: {
    signal?: AbortSignal
    onProgress?: (current: number, total: number, file: string) => void
  },
): Promise<LintReport> {
  const start = Date.now()
  const issues: LintIssue[] = []

  // 获取所有文件
  const allFiles = await getAllFiles(wikiPath)
  const mdFiles = allFiles.filter((f) => f.endsWith(".md"))
  const total = mdFiles.length

  // 预先读取所有文件内容用于交叉检查
  const fileContents = new Map<string, string>()
  const fileHashes = new Map<string, string[]>() // hash -> files
  const incomingLinks = new Map<string, number>() // 相对路径 -> 被链入次数
  const allMdRelPaths = new Set<string>() // 所有 md 的相对路径（无扩展名）

  // 初始化相对路径集合
  for (const file of mdFiles) {
    const rel = relative(wikiPath, file).replace(/\.md$/, "")
    allMdRelPaths.add(rel)
    incomingLinks.set(rel, 0)
  }

  // 逐文件扫描
  for (let i = 0; i < mdFiles.length; i++) {
    options?.signal?.throwIfAborted()
    const file = mdFiles[i]
    const relPath = relative(wikiPath, file)
    options?.onProgress?.(i + 1, total, relPath)

    const content = await readFile(file, "utf-8")
    fileContents.set(relPath, content)

    // SHA256 重复检测
    const hash = createHash("sha256").update(content).digest("hex")
    if (!fileHashes.has(hash)) {
      fileHashes.set(hash, [])
    }
    fileHashes.get(hash)!.push(relPath)

    // 结构检查
    const fm = parseFrontmatter(content)
    if (!fm) {
      issues.push({
        rule: RULES.structure,
        file: relPath,
        message: "缺少 YAML frontmatter",
        severity: "error",
        autoFixable: false,
      })
    } else {
      if (!fm.title)
        issues.push({
          rule: RULES.structure,
          file: relPath,
          message: "frontmatter 缺少 title 字段",
          severity: "error",
          autoFixable: false,
        })
      if (!fm.tags)
        issues.push({
          rule: RULES.structure,
          file: relPath,
          message: "frontmatter 缺少 tags 字段",
          severity: "error",
          autoFixable: true,
        })
      if (!fm.created)
        issues.push({
          rule: RULES.structure,
          file: relPath,
          message: "frontmatter 缺少 created 字段",
          severity: "error",
          autoFixable: true,
        })
    }

    // 死链检查
    const links = extractWikiLinks(content)
    for (const link of links) {
      if (allMdRelPaths.has(link)) {
        incomingLinks.set(link, (incomingLinks.get(link) || 0) + 1)
      } else {
        issues.push({
          rule: RULES["dead-links"],
          file: relPath,
          message: `链接 [[${link}]] 指向不存在的文件`,
          severity: "error",
          autoFixable: false,
        })
      }
    }

    // 质量检查
    if (content.trim().length === 0) {
      issues.push({
        rule: RULES.quality,
        file: relPath,
        message: "文件为空",
        severity: "warning",
        autoFixable: false,
      })
    } else {
      const body = getBodyContent(content)
      if (body.trim().length < 50) {
        issues.push({
          rule: RULES.quality,
          file: relPath,
          message: "正文内容少于 50 个字符",
          severity: "warning",
          autoFixable: false,
        })
      }
    }
    if (fm) {
      const tags = fm.tags as unknown[] | undefined
      if (!tags || (Array.isArray(tags) && tags.length === 0)) {
        issues.push({
          rule: RULES.quality,
          file: relPath,
          message: "没有设置任何标签",
          severity: "info",
          autoFixable: false,
        })
      }
    }

    // 目录规范检查
    const topDir = relPath.split("/")[0]
    if (DIR_TYPE_MAP[topDir]) {
      const expectedType = DIR_TYPE_MAP[topDir]
      if (!fm) {
        issues.push({
          rule: RULES.directory,
          file: relPath,
          message: `${topDir}/ 下的文件需要 frontmatter 且 type 为 '${expectedType}'`,
          severity: "error",
          autoFixable: true,
        })
      } else if (fm.type !== expectedType) {
        issues.push({
          rule: RULES.directory,
          file: relPath,
          message: `${topDir}/ 下的文件 type 应为 '${expectedType}'，当前为 '${fm.type || "未设置"}'`,
          severity: "error",
          autoFixable: true,
        })
      }
    }
  }

  options?.signal?.throwIfAborted()

  // 孤儿页面检查
  for (const [rel, count] of incomingLinks) {
    if (count === 0) {
      issues.push({
        rule: RULES["orphan-pages"],
        file: rel + ".md",
        message: "没有任何其他页面链接到此页面",
        severity: "info",
        autoFixable: false,
      })
    }
  }

  // 重复文件检查
  for (const [, files] of fileHashes) {
    if (files.length > 1) {
      for (const file of files) {
        issues.push({
          rule: RULES.duplicates,
          file,
          message: `与以下文件内容完全相同: ${files.filter((f) => f !== file).join(", ")}`,
          severity: "warning",
          autoFixable: false,
        })
      }
    }
  }

  // 上传完整性检查
  const uploadsDir = join(wikiPath, "raw", "uploads")
  const uploadFiles = allFiles.filter((f) => f.startsWith(uploadsDir))
  for (const file of uploadFiles) {
    options?.signal?.throwIfAborted()
    const name = basename(file)
    if (name.endsWith(".extracted.md")) continue
    const expectedExtracted = file + ".extracted.md"
    if (!allFiles.includes(expectedExtracted)) {
      const relPath = relative(wikiPath, file)
      issues.push({
        rule: RULES["upload-integrity"],
        file: relPath,
        message: "缺少对应的 .extracted.md 文件",
        severity: "warning",
        autoFixable: false,
      })
    }
  }

  const duration = Date.now() - start
  return { issues, scannedFiles: total, duration }
}
