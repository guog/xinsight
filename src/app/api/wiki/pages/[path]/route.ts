import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { join } from "path"
import { readFile } from "fs/promises"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
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
