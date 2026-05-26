import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"

const repo = new SqliteDatasourceRepository(db)

export interface BatchQueryDeps {
  findById: (id: string) => Promise<Record<string, unknown> | null>
  getAgentBindings: (agentId: string) => Promise<string[]>
  getAdapter: (type: string) => {
    query: (
      config: unknown,
      params: unknown,
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>
  } | null
}

export async function executeBatchQuery(
  queries: Array<{ datasourceId: string; endpointId?: string; params?: Record<string, unknown> }>,
  agentId: string | undefined,
  deps: BatchQueryDeps,
) {
  const results = await Promise.all(
    queries.map(async (query) => {
      const { datasourceId, endpointId, params = {} } = query
      const startTime = Date.now()

      const config = await deps.findById(datasourceId)
      if (!config) {
        return {
          datasourceId,
          datasourceName: datasourceId,
          success: false as const,
          error: `数据源 "${datasourceId}" 未找到`,
        }
      }
      if (!config.enabled) {
        return {
          datasourceId,
          datasourceName: config.name as string,
          success: false as const,
          error: `数据源 "${config.name}" 已禁用`,
        }
      }

      // 权限检查
      if (agentId) {
        const bindings = await deps.getAgentBindings(agentId)
        if (bindings.length > 0 && !bindings.includes(datasourceId)) {
          return {
            datasourceId,
            datasourceName: config.name as string,
            success: false as const,
            error: `当前 Agent 无权访问数据源 "${config.name}"`,
          }
        }
      }

      // 合并 endpoint 参数
      let mergedParams = params
      if (endpointId) {
        const endpoints = config.endpoints as
          | Array<{ id: string; params?: Record<string, unknown> }>
          | undefined
        const endpoint = endpoints?.find((ep) => ep.id === endpointId)
        if (!endpoint) {
          return {
            datasourceId,
            datasourceName: config.name as string,
            success: false as const,
            error: `未找到接口 "${endpointId}"`,
          }
        }
        mergedParams = { ...endpoint.params, ...params }
      }

      const adapter = deps.getAdapter(config.type as string)
      if (!adapter) {
        return {
          datasourceId,
          datasourceName: config.name as string,
          success: false as const,
          error: `不支持的数据源类型: ${config.type}`,
        }
      }

      const result = await adapter.query(
        {
          id: config.id,
          name: config.name,
          type: config.type as DatasourceConfig["type"],
          auth: config.auth as DatasourceConfig["auth"],
          config: config.config,
          endpoints: config.endpoints,
          enabled: config.enabled,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
        mergedParams,
      )

      return {
        datasourceId,
        datasourceName: config.name as string,
        success: result.success,
        data: result.data,
        error: result.error,
        duration: Date.now() - startTime,
      }
    }),
  )

  return { results }
}

// 默认依赖
const defaultDeps: BatchQueryDeps = {
  findById: (id) => repo.findById(id) as Promise<Record<string, unknown> | null>,
  getAgentBindings: (agentId) => repo.getAgentBindings(agentId),
  getAdapter: (type) =>
    getAdapter(type) as BatchQueryDeps["getAdapter"] extends (t: string) => infer R ? R : never,
}

/**
 * datasource-batch-query — 并行查询多个数据源
 */
export const datasourceBatchQueryTool = createTool({
  id: "datasource-batch-query",
  description:
    "并行查询多个数据源，适用于跨源关联分析。" +
    "一次调用可同时获取多个数据源的数据，减少等待时间。" +
    "每个查询项需指定 datasourceId 和可选的 endpointId、params。",
  inputSchema: z.object({
    queries: z
      .array(
        z.object({
          datasourceId: z.string().describe("数据源 ID"),
          endpointId: z.string().optional().describe("接口 ID"),
          params: z.record(z.string(), z.unknown()).optional().describe("查询参数"),
        }),
      )
      .min(1)
      .max(5)
      .describe("查询列表，最多 5 个并行查询"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        datasourceId: z.string(),
        datasourceName: z.string(),
        success: z.boolean(),
        data: z.unknown().optional(),
        error: z.string().optional(),
        duration: z.number().optional(),
      }),
    ),
  }),
  execute: async (inputData, context) => {
    const agentId = (context as unknown as { resourceId?: string })?.resourceId
    return executeBatchQuery(inputData.queries, agentId, defaultDeps)
  },
})
