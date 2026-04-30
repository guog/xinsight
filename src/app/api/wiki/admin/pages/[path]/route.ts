import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { join } from "path"
import { readFile, writeFile } from "fs/promises"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

// 读取页面内容
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { path: pagePath } = await params
    const decoded = decodeURIComponent(pagePath)
    if (decoded.includes("..")) {
      return NextResponse.json({ error: "无效路径" }, { status: 400 })
    }
    const fullPath = join(WIKI_PATH, decoded)
    const content = await readFile(fullPath, "utf-8")
    return NextResponse.json({ path: decoded, content })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}

// 更新页面内容
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { path: pagePath } = await params
    const decoded = decodeURIComponent(pagePath)
    if (decoded.includes("..")) {
      return NextResponse.json({ error: "无效路径" }, { status: 400 })
    }
    const { content } = await req.json()
    const fullPath = join(WIKI_PATH, decoded)
    await writeFile(fullPath, content, "utf-8")
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}
