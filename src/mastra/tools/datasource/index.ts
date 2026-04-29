import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { getAdapter } from "./adapters"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"

export { type DatasourceAdapter, type DatasourceResult } from "./types"
import type { DatasourceConfig } from "./types"
export type { DatasourceConfig } from "./types"

const repo = new SqliteDatasourceRepository(db)

/**
 * datasource-query — Agent 调用此工具从第三方系统实时抓取数据
 *
 * 权限：只能查询当前 Agent 绑定的数据源
 */
export const datasourceQueryTool = createTool({
  id: "datasource-query",
  description:
    "从已注册的第三方数据源（MES、ERP 等工业系统）实时查询数据。" +
    "推荐用法：指定 endpointId 选择接口，系统会自动合并默认参数，你只需传覆盖/补充参数。" +
    "也可不传 endpointId，直接在 params 中指定完整查询参数。" +
    "先调用 datasource-list 获取可用数据源及其接口列表。",
  inputSchema: z.object({
    datasourceId: z.string().describe("数据源 ID"),
    endpointId: z
      .string()
      .optional()
      .describe("接口 ID（来自 datasource-list 返回的 endpoints[].id）"),
    params: z
      .record(z.string(), z.unknown())
      .describe("查询参数（会与 endpoint 默认参数合并，用户参数优先）"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    metadata: z
      .object({
        duration: z.number(),
        datasourceId: z.string(),
        datasourceName: z.string(),
      })
      .optional(),
  }),
  execute: async (inputData, context) => {
    const { datasourceId, endpointId, params } = inputData
    const agentId = (context as unknown as { resourceId?: string })?.resourceId

    const config = await repo.findById(datasourceId)
    if (!config) return { success: false, error: `数据源 "${datasourceId}" 未找到` }
    if (!config.enabled) return { success: false, error: `数据源 "${config.name}" 已禁用` }

    // 权限检查 — 只允许绑定的数据源
    if (agentId) {
      const bindings = await repo.getAgentBindings(agentId)
      if (bindings.length > 0 && !bindings.includes(datasourceId)) {
        return { success: false, error: `当前 Agent 无权访问数据源 "${config.name}"` }
      }
    }

    // 合并 endpoint 默认参数 + 用户传入参数
    let mergedParams = params
    if (endpointId) {
      const endpoint = config.endpoints?.find((ep: { id: string }) => ep.id === endpointId)
      if (!endpoint) {
        return { success: false, error: `数据源 "${config.name}" 中未找到接口 "${endpointId}"` }
      }
      mergedParams = { ...endpoint.params, ...params }
    }

    const adapter = getAdapter(config.type)
    if (!adapter) return { success: false, error: `不支持的数据源类型: ${config.type}` }

    return adapter.query(
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
  },
})

/**
 * datasource-list — 列出当前 Agent 可用的数据源及其接口
 */
export const datasourceListTool = createTool({
  id: "datasource-list",
  description:
    "列出当前 Agent 可用的数据源及其接口列表。返回数据源 ID、名称、类型、描述和可调用的接口。" +
    "每个接口包含参数说明（paramSchema）和格式类型（apiSchemaFormat: natural=自然语言 / openapi=JSON Schema）。" +
    "请先调用此工具了解可用数据源，再用 datasource-query 查询具体数据。",
  inputSchema: z.object({}),
  outputSchema: z.object({
    datasources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        description: z.string().nullable(),
        endpoints: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            params: z.record(z.string(), z.unknown()),
            paramSchema: z.string().optional(),
            apiSchemaFormat: z.enum(["natural", "openapi"]).optional(),
            responseExample: z.string().optional(),
          }),
        ),
      }),
    ),
  }),
  execute: async (_inputData, context) => {
    const agentId = (context as unknown as { resourceId?: string })?.resourceId
    const list = agentId ? await repo.findByAgentId(agentId) : await repo.findAllEnabled()
    return {
      datasources: list.map((ds) => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
        description: ds.description,
        endpoints: ds.endpoints,
      })),
    }
  },
})
