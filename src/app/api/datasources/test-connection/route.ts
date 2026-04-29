import { NextResponse } from "next/server"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** POST /api/datasources/test-connection — 表单内连接测试（无需已保存的数据源） */
export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { type, config, auth } = body

    if (!type) {
      return NextResponse.json({ error: "缺少数据源类型" }, { status: 400 })
    }

    const adapter = getAdapter(type)
    if (!adapter) {
      return NextResponse.json({ error: `不支持的数据源类型: ${type}` }, { status: 400 })
    }

    const tempConfig: DatasourceConfig = {
      id: "test",
      name: "test",
      description: undefined,
      type: type as DatasourceConfig["type"],
      auth: auth ?? {},
      config: config ?? {},
      endpoints: [],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const start = Date.now()
    const result = await adapter.testConnection(tempConfig)
    const latency = Date.now() - start

    return NextResponse.json({ ok: result.ok, message: result.message ?? "", latency })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("表单内连接测试失败:", error)
    return NextResponse.json({ error: "连接测试失败" }, { status: 500 })
  }
}
