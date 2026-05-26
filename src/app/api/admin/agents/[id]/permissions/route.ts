import { NextResponse } from "next/server"
import { db } from "@/db"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"
import { z } from "zod"

const repo = new SqliteAgentRepository(db)

type Params = { params: Promise<{ id: string }> }

const UpdatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      subjectType: z.enum(["role", "team", "user"]),
      subjectId: z.string().min(1),
      permissionType: z.string().optional(),
    }),
  ),
})

/** GET /api/admin/agents/[id]/permissions — 获取指定 Agent 的权限绑定列表 */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  try {
    const permissions = await repo.getPermissions(id)
    return NextResponse.json({ permissions })
  } catch (error) {
    console.error("获取 Agent 权限失败:", error)
    return NextResponse.json({ error: "获取 Agent 权限失败" }, { status: 500 })
  }
}

/** PUT /api/admin/agents/[id]/permissions — 保存指定 Agent 的权限绑定列表 */
export async function PUT(req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdatePermissionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  try {
    await repo.updatePermissions(id, parsed.data.permissions)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("保存 Agent 权限失败:", error)
    return NextResponse.json({ error: "保存 Agent 权限失败" }, { status: 500 })
  }
}
