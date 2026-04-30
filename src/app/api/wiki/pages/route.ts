import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { join, relative } from "path"
import { readdir, stat, readFile } from "fs/promises"
import matter from "gray-matter"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

async function scanPages(dir: string): Promise<Record<string, unknown>[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const results: Record<string, unknown>[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== "raw") {
      results.push(...(await scanPages(fullPath)))
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      const fileStat = await stat(fullPath)
      const relPath = relative(WIKI_PATH, fullPath)
      const raw = await readFile(fullPath, "utf-8")
      const { data: frontmatter } = matter(raw)
      results.push({
        path: relPath,
        title: frontmatter.title || entry.name.replace(/\.mdx?$/, ""),
        type: frontmatter.type || "page",
        tags: frontmatter.tags || [],
        modified: fileStat.mtime.toISOString(),
      })
    }
  }
  return results
}

export async function GET() {
  const session = await getCurrentUser()
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  try {
    const pages = await scanPages(WIKI_PATH)
    return NextResponse.json(pages)
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}
