import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"

/** GET /api/datasources/[id] — 获取单个数据源 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    const datasource = await repo.findById(id)
    if (!datasource) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }
    return NextResponse.json(datasource)
  } catch (error) {
    console.error("获取数据源失败:", error)
    return NextResponse.json({ error: "获取数据源失败" }, { status: 500 })
  }
}

/** PUT /api/datasources/[id] — 更新数据源 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const repo = new SqliteDatasourceRepository(db)
    const existing = await repo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }
    const datasource = await repo.update(id, body)
    return NextResponse.json(datasource)
  } catch (error) {
    console.error("更新数据源失败:", error)
    return NextResponse.json({ error: "更新数据源失败" }, { status: 500 })
  }
}

/** DELETE /api/datasources/[id] — 删除数据源 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    await repo.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除数据源失败:", error)
    return NextResponse.json({ error: "删除数据源失败" }, { status: 500 })
  }
}
