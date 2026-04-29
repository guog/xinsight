import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { requireAdmin } from "@/lib/auth"

/** GET /api/datasources/[id]/agents — 获取数据源绑定的 Agent 列表 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    const agents = await repo.getDatasourceAgents(id)
    return NextResponse.json(agents)
  } catch (error) {
    console.error("获取绑定 Agent 列表失败:", error)
    return NextResponse.json({ error: "获取绑定 Agent 列表失败" }, { status: 500 })
  }
}

/** POST /api/datasources/[id]/agents — 绑定 Agent */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { agentId } = await request.json()
    if (!agentId) {
      return NextResponse.json({ error: "缺少 agentId" }, { status: 400 })
    }
    const repo = new SqliteDatasourceRepository(db)
    await repo.bindAgent(agentId, id)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "未登录" || error.message === "需要管理员权限")
    ) {
      const status = error.message === "未登录" ? 401 : 403
      return Response.json({ error: error.message }, { status })
    }
    console.error("绑定 Agent 失败:", error)
    return NextResponse.json({ error: "绑定 Agent 失败" }, { status: 500 })
  }
}

/** DELETE /api/datasources/[id]/agents — 解绑 Agent */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { agentId } = await request.json()
    if (!agentId) {
      return NextResponse.json({ error: "缺少 agentId" }, { status: 400 })
    }
    const repo = new SqliteDatasourceRepository(db)
    await repo.unbindAgent(agentId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "未登录" || error.message === "需要管理员权限")
    ) {
      const status = error.message === "未登录" ? 401 : 403
      return Response.json({ error: error.message }, { status })
    }
    console.error("解绑 Agent 失败:", error)
    return NextResponse.json({ error: "解绑 Agent 失败" }, { status: 500 })
  }
}
