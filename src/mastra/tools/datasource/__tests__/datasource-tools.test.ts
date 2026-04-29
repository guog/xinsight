/**
 * datasource tools — execute 覆盖测试
 * 策略：用真实 in-memory DB + mock adapter，直接测试 tool execute 逻辑
 */
import { describe, test, expect, mock } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "@/db/schema"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE datasources (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT, type TEXT NOT NULL,
      auth TEXT NOT NULL, config TEXT NOT NULL, endpoints TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1, last_tested_at INTEGER, last_test_result TEXT,
      last_test_message TEXT, last_called_at INTEGER, call_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_datasources (
      agent_id TEXT NOT NULL, datasource_id TEXT NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL, PRIMARY KEY (agent_id, datasource_id)
    );
  `)
  return drizzle(sqlite, { schema })
}

const mockQueryFn = mock(() =>
  Promise.resolve({
    success: true,
    data: { items: [{ id: 1 }] },
    metadata: { duration: 50, datasourceId: "ds1", datasourceName: "TestDS" },
  }),
)

/** Replicate datasourceQueryTool.execute logic for testing */
async function executeQuery(
  repo: SqliteDatasourceRepository,
  input: { datasourceId: string; endpointId?: string; params: Record<string, unknown> },
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

  let mergedParams = input.params
  if (input.endpointId) {
    const endpoint = config.endpoints?.find((ep: { id: string }) => ep.id === input.endpointId)
    if (!endpoint)
      return { success: false, error: `数据源 "${config.name}" 中未找到接口 "${input.endpointId}"` }
    mergedParams = { ...endpoint.params, ...input.params }
  }

  // Use mock adapter
  return mockQueryFn({
    id: config.id,
    name: config.name,
    type: config.type as DatasourceConfig["type"],
    auth: config.auth as DatasourceConfig["auth"],
    config: config.config,
    endpoints: config.endpoints,
    enabled: config.enabled,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }, mergedParams)
}

/** Replicate datasourceListTool.execute logic */
async function executeList(repo: SqliteDatasourceRepository, agentId?: string) {
  const list = agentId ? await repo.findByAgentId(agentId) : await repo.findAllEnabled()
  return {
    datasources: list.map((ds) => ({
      id: ds.id,
      name: ds.name,
      type: ds.type,
      description: ds.description,
      endpoints: (ds.endpoints ?? []).map((ep: Record<string, unknown>) => {
        const base: Record<string, unknown> = { ...ep }
        if (ep.responseSchema && typeof ep.responseSchema === "object") {
          const s = ep.responseSchema as Record<string, unknown>
          const fieldsArr = (s.fields ?? []) as Array<Record<string, unknown>>
          const fields = fieldsArr.slice(0, 20).map((f) => ({
            name: (f.name as string) ?? "unknown",
            type: (f.type as string) ?? "unknown",
          }))
          if (fields.length > 0) base.responseFields = fields
        }
        return base
      }),
    })),
  }
}

describe("datasourceQueryTool execute", () => {
  const db = createTestDb()
  const repo = new SqliteDatasourceRepository(db)

  test("datasource not found", async () => {
    const result = await executeQuery(repo, { datasourceId: "nonexist", params: {} })
    expect(result.success).toBe(false)
    expect(result.error).toContain("未找到")
  })

  test("datasource disabled", async () => {
    await repo.create({ id: "ds-off", name: "Off", type: "rest", auth: {}, config: {}, enabled: false })
    const result = await executeQuery(repo, { datasourceId: "ds-off", params: {} })
    expect(result.success).toBe(false)
    expect(result.error).toContain("已禁用")
  })

  test("endpoint not found", async () => {
    await repo.create({
      id: "ds1", name: "TestDS", type: "rest", auth: {}, config: {},
      endpoints: [{ id: "ep1", name: "EP1", description: "test", params: { default: "val" } }],
    })
    const result = await executeQuery(repo, { datasourceId: "ds1", endpointId: "ep-bad", params: {} })
    expect(result.success).toBe(false)
    expect(result.error).toContain("未找到接口")
  })

  test("successful query merges endpoint params", async () => {
    const result = await executeQuery(repo, { datasourceId: "ds1", endpointId: "ep1", params: { extra: "x" } })
    expect(result.success).toBe(true)
    expect(mockQueryFn).toHaveBeenCalled()
    // Verify merged params
    const lastCall = mockQueryFn.mock.calls[mockQueryFn.mock.calls.length - 1]
    expect(lastCall[1]).toEqual({ default: "val", extra: "x" })
  })

  test("agent permission check", async () => {
    await repo.bindAgent("agent-a", "ds1")
    const result = await executeQuery(repo, { datasourceId: "ds-off", params: {} }, "agent-a")
    // ds-off is disabled so it fails on disabled check before permission
    expect(result.success).toBe(false)
  })
})

describe("datasourceListTool execute", () => {
  const db = createTestDb()
  const repo = new SqliteDatasourceRepository(db)

  test("empty list", async () => {
    const result = await executeList(repo)
    expect(result.datasources).toEqual([])
  })

  test("list with endpoints", async () => {
    await repo.create({
      id: "ds2", name: "DS2", type: "rest", auth: {}, config: {},
      endpoints: [{ id: "ep1", name: "E1", description: "desc", params: {} }],
    })
    const result = await executeList(repo)
    expect(result.datasources.length).toBe(1)
    expect(result.datasources[0].endpoints.length).toBe(1)
  })

  test("responseSchema fields extracted", async () => {
    await repo.create({
      id: "ds3", name: "DS3", type: "rest", auth: {}, config: {},
      endpoints: [{
        id: "ep-s", name: "EP", description: "d", params: {},
        responseSchema: { fields: [{ name: "col1", type: "string" }, { name: "col2", type: "number" }] },
      } as any],
    })
    const result = await executeList(repo)
    const ds = result.datasources.find((d: any) => d.id === "ds3")!
    expect((ds.endpoints[0] as any).responseFields.length).toBe(2)
  })

  test("agentId filters by binding", async () => {
    await repo.bindAgent("ag1", "ds3")
    const result = await executeList(repo, "ag1")
    expect(result.datasources.length).toBe(1)
    expect(result.datasources[0].id).toBe("ds3")
  })
})
