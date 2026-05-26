import { NextResponse } from "next/server"
import { db } from "@/db"
import { workflows } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"

type Params = { params: Promise<{ id?: string }> }

/** GET /api/admin/workflows/[id] — 获取指定工作流的详细定义 */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "缺少必要参数 id" }, { status: 400 })
  }
  try {
    const wf = db.select().from(workflows).where(eq(workflows.id, id)).get()
    if (!wf) {
      return NextResponse.json({ error: "工作流不存在" }, { status: 404 })
    }
    return NextResponse.json({ workflow: wf })
  } catch (error) {
    console.error("获取工作流详情失败:", error)
    return NextResponse.json({ error: "获取工作流详情失败" }, { status: 500 })
  }
}

/** PUT /api/admin/workflows/[id] — 更新工作流定义 */
export async function PUT(req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "缺少必要参数 id" }, { status: 400 })
  }
  try {
    const body = await req.json()
    const { name, description, definition, status } = body as {
      name?: string
      description?: string
      definition?: string
      status?: "draft" | "published"
    }

    const wf = db.select().from(workflows).where(eq(workflows.id, id)).get()
    if (!wf) {
      return NextResponse.json({ error: "工作流不存在" }, { status: 404 })
    }

    db.update(workflows)
      .set({
        ...(name ? { name } : {}),
        description: description !== undefined ? description : wf.description,
        ...(definition ? { definition } : {}),
        ...(status ? { status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, id))
      .run()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("更新工作流失败:", error)
    return NextResponse.json({ error: "更新工作流失败" }, { status: 500 })
  }
}

/** DELETE /api/admin/workflows/[id] — 删除指定工作流（级联删除关联的执行历史） */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "缺少必要参数 id" }, { status: 400 })
  }
  try {
    const wf = db.select().from(workflows).where(eq(workflows.id, id)).get()
    if (!wf) {
      return NextResponse.json({ error: "工作流不存在" }, { status: 404 })
    }

    db.delete(workflows).where(eq(workflows.id, id)).run()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除工作流失败:", error)
    return NextResponse.json({ error: "删除工作流失败" }, { status: 500 })
  }
}
