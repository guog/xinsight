/**
 * 自动生成 wiki/index.md — 从所有页面的 frontmatter 构建目录
 */
import { readFile, writeFile, readdir } from "fs/promises"
import { join } from "path"

const WIKI_PATH = join(import.meta.dir, "../wiki")
const TYPES = ["entities", "concepts", "notes", "references"]

interface PageMeta {
  title: string
  tags: string[]
  type: string
  filename: string
}

function parseFrontmatter(content: string): Partial<PageMeta> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm = match[1]
  const title = fm.match(/title:\s*"(.+?)"/)?.[1] || ""
  const tagsMatch = fm.match(/tags:\s*\[(.+?)\]/)
  const tags = tagsMatch
    ? tagsMatch[1].match(/"([^"]+)"/g)?.map((t) => t.replace(/"/g, "")) || []
    : []
  const type = fm.match(/type:\s*(\w+)/)?.[1] || ""
  return { title, tags, type }
}

async function main() {
  const pages: PageMeta[] = []

  for (const type of TYPES) {
    const dir = join(WIKI_PATH, type)
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue
    }

    for (const file of files.filter((f) => f.endsWith(".md"))) {
      const content = await readFile(join(dir, file), "utf-8")
      const meta = parseFrontmatter(content)
      pages.push({
        title: meta.title || file.replace(".md", ""),
        tags: meta.tags || [],
        type,
        filename: file.replace(".md", ""),
      })
    }
  }

  // Build index.md
  const now = new Date().toISOString().slice(0, 10)
  let index = `# 西安基地智能制造知识库

> 总页面: ${pages.length} | 最后更新: ${now}
> 知识领域: WMS仓储、MES生产、物流系统、项目管理

`

  for (const type of TYPES) {
    const typePages = pages
      .filter((p) => p.type === type)
      .sort((a, b) => a.title.localeCompare(b.title, "zh"))
    const label = {
      entities: "实体 (Entities)",
      concepts: "概念 (Concepts)",
      notes: "笔记 (Notes)",
      references: "参考 (References)",
    }[type]

    index += `## ${label}\n\n`
    for (const p of typePages) {
      const tagStr = p.tags.length > 0 ? ` [${p.tags.slice(0, 3).join(", ")}]` : ""
      index += `- [[${p.filename}]] ${p.title}${tagStr}\n`
    }
    index += "\n"
  }

  await writeFile(join(WIKI_PATH, "index.md"), index, "utf-8")
  console.log(`✅ index.md 已生成: ${pages.length} 个页面`)
  console.log(`  entities: ${pages.filter((p) => p.type === "entities").length}`)
  console.log(`  concepts: ${pages.filter((p) => p.type === "concepts").length}`)
  console.log(`  notes: ${pages.filter((p) => p.type === "notes").length}`)
  console.log(`  references: ${pages.filter((p) => p.type === "references").length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
