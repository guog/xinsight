/**
 * Datasource Tools 集成测试
 * 策略：直接测试 Repository + Adapter 组合链路，模拟 tool 的核心逻辑
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import { createTestDb } from "../helpers/test-db"
import { server, mockRestUrl } from "../helpers/mock-server"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"
import type { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"

/** 模拟 datasource-list tool 的 execute 逻辑 */
async function executeList(repo: SqliteDatasourceRepository, agentId?: string) {
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
}

/** 模拟 datasource-query tool 的 execute 逻辑 */
async function executeQuery(
  repo: SqliteDatasourceRepository,
  input: { datasourceId: string; params: Record<string, unknown> },
  agentId?: string,
) {
  const config = await repo.findById(input.datasourceId)
  if (!config) return { success: false, error: `数据源 "${input.datasourceId}" 未找到` }
  if (!config.enabled) return { success: false, error: `数据源 "${config.name}" 已禁用` }

  if (agentId) {
    const bindings = await repo.getAgentBindings(agentId)
    if (bindings.length > 0 && !bindings.includes(input.datasourceId)) {
      return { success: false, error: `当前 Agent 无权访问数据源 "${config.name}"` }
    }
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
    input.params,
  )
}

describe("datasource tools 集成测试", () => {
  let repo: SqliteDatasourceRepository

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" })
    const testDb = createTestDb()
    repo = testDb.repo
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  describe("datasource-list", () => {
    it("无绑定时返回所有 enabled 数据源", async () => {
      // 插入测试数据
      await repo.create({
        id: "ds-enabled-1",
        name: "ERP 系统",
        type: "rest",
        auth: { type: "none" },
        config: { baseUrl: mockRestUrl },
        endpoints: [
          {
            id: "ep-1",
            name: "订单查询",
            description: "查询订单",
            params: {},
            apiSchemaFormat: "natural" as const,
          },
        ],
        enabled: true,
      })
      await repo.create({
        id: "ds-disabled-1",
        name: "已禁用系统",
        type: "rest",
        auth: { type: "none" },
        config: { baseUrl: mockRestUrl },
        endpoints: [],
        enabled: false,
      })

      const result = await executeList(repo)

      expect(result.datasources).toHaveLength(1)
      expect(result.datasources[0].id).toBe("ds-enabled-1")
      expect(result.datasources[0].name).toBe("ERP 系统")
      expect(result.datasources[0].endpoints).toHaveLength(1)
    })

    it("有 agentId 时只返回绑定的数据源", async () => {
      // 再插入一个 enabled 数据源
      await repo.create({
        id: "ds-enabled-2",
        name: "MES 系统",
        type: "rest",
        auth: { type: "none" },
        config: { baseUrl: mockRestUrl },
        endpoints: [],
        enabled: true,
      })

      // 只绑定 ds-enabled-1 到 agent-1
      await repo.bindAgent("agent-1", "ds-enabled-1")

      const result = await executeList(repo, "agent-1")

      expect(result.datasources).toHaveLength(1)
      expect(result.datasources[0].id).toBe("ds-enabled-1")
    })
  })

  describe("datasource-query", () => {
    it("成功查询 REST 数据源", async () => {
      // 插入一个有认证的 REST 数据源
      await repo.create({
        id: "ds-rest-query",
        name: "ERP REST",
        type: "rest",
        auth: { type: "bearer", token: "test-token" },
        config: { baseUrl: mockRestUrl },
        endpoints: [],
        enabled: true,
      })

      const result = await executeQuery(repo, {
        datasourceId: "ds-rest-query",
        params: { path: "/api/orders", method: "GET" },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        orders: [{ id: "O001", product: "钢材", quantity: 100 }],
      })
      expect(result.metadata?.datasourceId).toBe("ds-rest-query")
      expect(result.metadata?.datasourceName).toBe("ERP REST")
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0)
    })

    it("数据源不存在时返回错误", async () => {
      const result = await executeQuery(repo, {
        datasourceId: "ds-nonexistent",
        params: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("ds-nonexistent")
      expect(result.error).toContain("未找到")
    })
  })
})
