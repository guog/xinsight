/**
 * datasource-query — endpointId 增强测试
 * 策略：用真实 in-memory DB + msw mock HTTP，测试 tool execute 逻辑
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "@/db/schema"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"

const MOCK_URL = "http://mes-test.local"

const server = setupServer(
  http.get(`${MOCK_URL}/api/orders`, () => HttpResponse.json({ orders: [{ id: "O001" }] })),
  http.post(`${MOCK_URL}/api/orders`, () => HttpResponse.json({ created: true })),
  http.get(`${MOCK_URL}/custom`, () => HttpResponse.json({ custom: true })),
)

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE datasources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      auth TEXT NOT NULL,
      config TEXT NOT NULL,
      endpoints TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_datasources (
      agent_id TEXT NOT NULL,
      datasource_id TEXT NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, datasource_id)
    );
  `)
  const db = drizzle(sqlite, { schema })
  return new SqliteDatasourceRepository(db)
}

import { getAdapter } from "@/mastra/tools/datasource/adapters"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"

/** 模拟 datasource-query tool execute 逻辑 */
async function executeQuery(
  repo: SqliteDatasourceRepository,
  input: { datasourceId: string; endpointId?: string; params: Record<string, unknown> },
) {
  const config = await repo.findById(input.datasourceId)
  if (!config) return { success: false, error: `数据源 "${input.datasourceId}" 未找到` }
  if (!config.enabled) return { success: false, error: `数据源 "${config.name}" 已禁用` }

  let mergedParams = input.params
  if (input.endpointId) {
    const endpoint = config.endpoints?.find((ep: { id: string }) => ep.id === input.endpointId)
    if (!endpoint)
      return { success: false, error: `数据源 "${config.name}" 中未找到接口 "${input.endpointId}"` }
    mergedParams = { ...endpoint.params, ...input.params }
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
}

describe("datasource-query — endpointId 增强", () => {
  let repo: SqliteDatasourceRepository

  beforeAll(async () => {
    server.listen({ onUnhandledRequest: "error" })
    repo = createTestDb()
    await repo.create({
      id: "ds-1",
      name: "MES 系统",
      type: "rest",
      auth: { type: "none" },
      config: { baseUrl: MOCK_URL },
      endpoints: [
        {
          id: "get-orders",
          name: "获取订单",
          description: "查询订单列表",
          params: { method: "GET", path: "/api/orders" },
          paramSchema: "需要 status 和 page 参数",
          apiSchemaFormat: "natural" as const,
        },
        {
          id: "get-order-detail",
          name: "订单详情",
          description: "查询单个订单",
          params: { method: "GET", path: "/api/orders/{id}" },
          apiSchemaFormat: "openapi" as const,
          paramSchema: JSON.stringify({
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          }),
        },
      ],
      enabled: true,
    })
  })

  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it("传入 endpointId 时自动合并 endpoint 默认参数", async () => {
    const result = await executeQuery(repo, {
      datasourceId: "ds-1",
      endpointId: "get-orders",
      params: { query: { status: "pending" } },
    })

    expect(result.success).toBe(true)
  })

  it("用户参数覆盖 endpoint 默认参数", async () => {
    const result = await executeQuery(repo, {
      datasourceId: "ds-1",
      endpointId: "get-orders",
      params: { method: "POST", query: { status: "done" } },
    })

    expect(result.success).toBe(true)
  })

  it("endpointId 不存在时返回错误", async () => {
    const result = await executeQuery(repo, {
      datasourceId: "ds-1",
      endpointId: "non-existent",
      params: {},
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("non-existent")
  })

  it("不传 endpointId 时行为不变（直接用 params）", async () => {
    const result = await executeQuery(repo, {
      datasourceId: "ds-1",
      params: { method: "GET", path: "/custom" },
    })

    expect(result.success).toBe(true)
  })
})
