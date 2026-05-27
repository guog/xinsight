import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"
import { agentDatasources } from "@/db/schema"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import { requireAuth, handleAuthError } from "@/lib/auth"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"
import { and, eq } from "drizzle-orm"
import { safeFilterParams, isWriteEndpoint } from "@/mastra/tools/datasource/validate-params"

export async function POST(request: Request) {
  try {
    // 1. 登录校验
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error) ?? NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 2. 解析请求体
    const body = await request.json()
    const { agentId, datasourceId, endpointId, params } = body as {
      agentId: string
      datasourceId: string
      endpointId: string
      params?: Record<string, unknown>
    }

    if (!agentId || !datasourceId || !endpointId) {
      return NextResponse.json(
        { error: "缺少必要参数 agentId, datasourceId 或 endpointId" },
        { status: 400 },
      )
    }

    // 3. 校验用户对 Agent 的访问权限 (RBAC 鉴权)
    const agentRepo = new SqliteAgentRepository(db)
    const authorizedAgents = await agentRepo.getAuthorizedAgentsForUser(user.id, user.role)
    const isAuthorized = authorizedAgents.some((a) => a.id === agentId)
    if (!isAuthorized) {
      return NextResponse.json({ error: "您无权访问该 Agent" }, { status: 403 })
    }

    // 4. 校验 Agent 与数据源的绑定关联及二次确认配置 (防止恶意客户端绕过拦截机制)
    const binding = db
      .select()
      .from(agentDatasources)
      .where(
        and(eq(agentDatasources.agentId, agentId), eq(agentDatasources.datasourceId, datasourceId)),
      )
      .get()

    if (!binding) {
      return NextResponse.json({ error: "该 Agent 未配置此数据源访问权限" }, { status: 403 })
    }

    // 校验允许访问的 endpoint 列表 (白名单控制)
    let allowedEndpoints: string[] | null = null
    if (binding.endpointIds) {
      try {
        allowedEndpoints = JSON.parse(binding.endpointIds)
      } catch {}
    }
    if (allowedEndpoints && !allowedEndpoints.includes(endpointId)) {
      return NextResponse.json({ error: "该 Agent 无权访问此端点" }, { status: 403 })
    }

    // 校验该端点是否确实被标记为需要二次确认 (二次确认权限安全验证)
    let confirmationRequiredList: string[] = []
    if (binding.confirmationRequiredEndpoints) {
      try {
        confirmationRequiredList = JSON.parse(binding.confirmationRequiredEndpoints)
      } catch {}
    }
    if (!confirmationRequiredList.includes(endpointId)) {
      return NextResponse.json(
        { error: "该端点未配置二次确认机制，禁止直接通过 execute-write 接口调用" },
        { status: 403 },
      )
    }

    // 5. 查询数据源
    const repo = new SqliteDatasourceRepository(db)
    const ds = await repo.findById(datasourceId)
    if (!ds) {
      return NextResponse.json({ error: `数据源未找到: ${datasourceId}` }, { status: 404 })
    }

    if (!ds.enabled) {
      return NextResponse.json({ error: `数据源已被禁用: ${datasourceId}` }, { status: 400 })
    }

    // 6. 查找 endpoint
    const ep = ds.endpoints?.find((e) => e.id === endpointId)
    if (!ep) {
      return NextResponse.json({ error: `数据源下未找到目标端点: ${endpointId}` }, { status: 404 })
    }

    // 7. 校验是否为写操作端点
    if (!isWriteEndpoint(ep)) {
      return NextResponse.json({ error: "execute-write 接口仅支持写操作端点" }, { status: 400 })
    }

    // 8. 执行写操作
    const adapter = getAdapter(ds.type)
    if (!adapter) {
      return NextResponse.json({ error: `不支持的数据源类型: ${ds.type}` }, { status: 400 })
    }

    const mergedParams = { ...ep.params, ...safeFilterParams(params) }

    const result = await adapter.query(
      {
        id: ds.id,
        name: ds.name,
        type: ds.type as DatasourceConfig["type"],
        auth: ds.auth as DatasourceConfig["auth"],
        config: ds.config,
        endpoints: ds.endpoints,
        enabled: ds.enabled,
        createdAt: ds.createdAt,
        updatedAt: ds.updatedAt,
      },
      mergedParams,
    )

    // 记录调用次数
    try {
      await repo.recordCall(ds.id)
    } catch {
      // 忽略记录调用次数失败
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("执行写操作失败:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "执行写操作发生未知错误" },
      { status: 500 },
    )
  }
}
