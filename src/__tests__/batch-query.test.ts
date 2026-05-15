import { describe, it, expect, vi } from "vitest"

vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: vi.fn(),
}))
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: vi.fn(),
}))

import { executeBatchQuery, type BatchQueryDeps } from "@/mastra/tools/cross-source/batch-query"

function makeDeps(overrides: Partial<BatchQueryDeps> = {}): BatchQueryDeps {
  return {
    findById: async (id) => ({
      id,
      name: `数据源-${id}`,
      type: "rest",
      enabled: true,
      auth: null,
      config: {},
      endpoints: [{ id: "ep1", params: { default: "val" } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getAgentBindings: async () => [],
    getAdapter: () => ({
      query: async () => ({ success: true, data: { rows: [] } }),
    }),
    ...overrides,
  }
}

describe("executeBatchQuery", () => {
  it("成功查询单个数据源", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "ds1", params: {} }],
      "agent1",
      makeDeps(),
    )
    expect(result.results).toHaveLength(1)
    expect(result.results[0].success).toBe(true)
    expect(result.results[0].datasourceName).toBe("数据源-ds1")
  })

  it("数据源未找到返回错误", async () => {
    const deps = makeDeps({ findById: async () => null })
    const result = await executeBatchQuery([{ datasourceId: "missing" }], "agent1", deps)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("未找到")
  })

  it("数据源已禁用返回错误", async () => {
    const deps = makeDeps({
      findById: async () => ({ id: "ds1", name: "Test", type: "rest", enabled: false }),
    })
    const result = await executeBatchQuery([{ datasourceId: "ds1" }], "agent1", deps)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("已禁用")
  })

  it("无权限返回错误", async () => {
    const deps = makeDeps({
      getAgentBindings: async () => ["other-ds"],
    })
    const result = await executeBatchQuery([{ datasourceId: "ds1" }], "agent1", deps)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("无权访问")
  })

  it("endpoint 未找到返回错误", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "ds1", endpointId: "nonexistent", params: {} }],
      "agent1",
      makeDeps(),
    )
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("未找到接口")
  })

  it("不支持的适配器类型返回错误", async () => {
    const deps = makeDeps({ getAdapter: () => null })
    const result = await executeBatchQuery([{ datasourceId: "ds1" }], "agent1", deps)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("不支持的数据源类型")
  })

  it("合并 endpoint 默认参数", async () => {
    let capturedParams: unknown
    const deps = makeDeps({
      getAdapter: () => ({
        query: async (_config: unknown, params: unknown) => {
          capturedParams = params
          return { success: true, data: null }
        },
      }),
    })
    await executeBatchQuery(
      [{ datasourceId: "ds1", endpointId: "ep1", params: { custom: "override" } }],
      "agent1",
      deps,
    )
    expect(capturedParams).toEqual({ default: "val", custom: "override" })
  })

  it("并行查询多个数据源", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "ds1" }, { datasourceId: "ds2" }, { datasourceId: "ds3" }],
      "agent1",
      makeDeps(),
    )
    expect(result.results).toHaveLength(3)
    expect(result.results.every((r) => r.success)).toBe(true)
  })

  it("无 agentId 时跳过权限检查", async () => {
    const result = await executeBatchQuery([{ datasourceId: "ds1" }], undefined, makeDeps())
    expect(result.results[0].success).toBe(true)
  })

  it("返回包含 duration", async () => {
    const result = await executeBatchQuery([{ datasourceId: "ds1" }], "agent1", makeDeps())
    expect(result.results[0].duration).toBeGreaterThanOrEqual(0)
  })
})
