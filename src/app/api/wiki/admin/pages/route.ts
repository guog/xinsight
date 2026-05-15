import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { join, relative, resolve } from "path"
import { readdir, stat, unlink, readFile } from "fs/promises"
import matter from "gray-matter"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

// 递归扫描所有 wiki 页面
async function scanPages(dir: string): Promise<Record<string, unknown>[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: Record<string, unknown>[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
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
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      })
    }
  }
  return results
}

// 获取所有 wiki 页面列表
export async function GET() {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
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

// 删除指定 wiki 页面
export async function DELETE(req: NextRequest) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { path: pagePath } = await req.json()
    if (!pagePath) {
      return NextResponse.json({ error: "无效路径" }, { status: 400 })
    }
    const fullPath = resolve(WIKI_PATH, pagePath)
    const base = resolve(WIKI_PATH) + "/"
    if (!fullPath.startsWith(base) && fullPath !== resolve(WIKI_PATH)) {
      return NextResponse.json({ error: "无效路径" }, { status: 400 })
    }
    await unlink(fullPath)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}
