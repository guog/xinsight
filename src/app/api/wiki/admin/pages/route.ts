import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { join, relative, resolve, dirname } from "path"
import { readdir, stat, unlink, readFile, mkdir, writeFile, access } from "fs/promises"
import matter from "gray-matter"
import { db } from "@/db"
import { wikiNamespaces } from "@/db/schema"
import { eq } from "drizzle-orm"

function getWikiPath() {
  return process.env.WIKI_PATH || join(/* turbopackIgnore: true */ process.cwd(), "wiki")
}

// 递归扫描所有 wiki 页面
async function scanPages(
  dir: string,
  registeredNamespaces: string[],
): Promise<Record<string, unknown>[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: Record<string, unknown>[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await scanPages(fullPath, registeredNamespaces)))
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      const fileStat = await stat(fullPath)
      const relPath = relative(getWikiPath(), fullPath)
      const raw = await readFile(fullPath, "utf-8")
      const { data: frontmatter } = matter(raw)

      // 判断页面所属的 namespace
      let pageNamespace = null
      const pathParts = relPath.split("/")
      if (pathParts.length > 1 && registeredNamespaces.includes(pathParts[0])) {
        pageNamespace = pathParts[0]
      }

      results.push({
        path: relPath,
        title: frontmatter.title || entry.name.replace(/\.mdx?$/, ""),
        type: frontmatter.type || "page",
        tags: frontmatter.tags || [],
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
        namespace: pageNamespace,
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
    const nss = await db.select({ name: wikiNamespaces.name }).from(wikiNamespaces).all()
    const registeredNamespaces = nss.map((r) => r.name)

    const pages = await scanPages(getWikiPath(), registeredNamespaces)
    return NextResponse.json(pages)
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}

// 新建 wiki 页面
export async function POST(req: NextRequest) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { path: pagePath, content, namespace } = await req.json()
    if (!pagePath) {
      return NextResponse.json({ error: "无效路径" }, { status: 400 })
    }

    // 1. 确定最终相对路径
    let relPath = pagePath
    if (namespace) {
      // 检查 namespace 是否注册
      const ns = await db
        .select()
        .from(wikiNamespaces)
        .where(eq(wikiNamespaces.name, namespace))
        .get()
      if (!ns) {
        return NextResponse.json({ error: `分区 "${namespace}" 不存在` }, { status: 400 })
      }
      // 确保路径在分区目录下
      if (!pagePath.startsWith(namespace + "/")) {
        relPath = `${namespace}/${pagePath}`
      }
    }

    // 2. 路径安全校验（防御路径遍历）
    const wikiRoot = resolve(getWikiPath())
    const fullPath = resolve(wikiRoot, relPath)
    const base = wikiRoot + "/"
    if (!fullPath.startsWith(base) && fullPath !== wikiRoot) {
      return NextResponse.json({ error: "无效或非法的路径" }, { status: 400 })
    }

    // 3. 后缀名校验
    if (!fullPath.endsWith(".md") && !fullPath.endsWith(".mdx")) {
      return NextResponse.json({ error: "文件后缀必须是 .md 或 .mdx" }, { status: 400 })
    }

    // 4. 判断文件是否已存在
    let exists = false
    try {
      await access(fullPath)
      exists = true
    } catch {}

    if (exists) {
      return NextResponse.json({ error: "文件已存在，无法新建" }, { status: 400 })
    }

    // 5. 写入文件（确保目录存在）
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content || "", "utf-8")

    return NextResponse.json({ ok: true, path: relPath })
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
    const fullPath = resolve(getWikiPath(), pagePath)
    const base = resolve(getWikiPath()) + "/"
    if (!fullPath.startsWith(base) && fullPath !== resolve(getWikiPath())) {
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
