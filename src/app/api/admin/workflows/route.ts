import { NextResponse } from "next/server"
import { db } from "@/db"
import { workflows } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** GET /api/admin/workflows — 获取系统所有工作流定义列表（仅管理员） */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  try {
    const list = db.select().from(workflows).orderBy(desc(workflows.createdAt)).all()
    return NextResponse.json({ workflows: list })
  } catch (error) {
    console.error("获取工作流列表失败:", error)
    return NextResponse.json({ error: "获取工作流列表失败" }, { status: 500 })
  }
}

/** POST /api/admin/workflows — 创建新工作流定义（仅管理员） */
export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  try {
    const body = await req.json()
    const { id, name, description, definition } = body as {
      id: string
      name: string
      description?: string
      definition: string
    }

    if (!id || !name || !definition) {
      return NextResponse.json({ error: "缺少必要字段 id, name 或 definition" }, { status: 400 })
    }

    const existing = db.select().from(workflows).where(eq(workflows.id, id)).get()
    if (existing) {
      return NextResponse.json({ error: "工作流 ID 已存在" }, { status: 409 })
    }

    const now = new Date()
    db.insert(workflows)
      .values({
        id,
        name,
        description: description ?? null,
        definition,
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("创建工作流失败:", error)
    return NextResponse.json({ error: "创建工作流失败" }, { status: 500 })
  }
}
