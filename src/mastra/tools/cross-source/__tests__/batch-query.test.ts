import { describe, test, expect } from "bun:test"
import { executeBatchQuery, type BatchQueryDeps } from "../batch-query"

// 测试用的 mock 数据源
const mockSources: Record<string, Record<string, unknown>> = {
  "ds-1": {
    id: "ds-1",
    name: "MES系统",
    type: "rest_api",
    enabled: true,
    auth: { type: "none" },
    config: { baseUrl: "http://mes.local" },
    endpoints: [{ id: "ep-1", name: "产量", params: { line: "A1" } }],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "ds-2": {
    id: "ds-2",
    name: "ERP系统",
    type: "rest_api",
    enabled: true,
    auth: { type: "none" },
    config: { baseUrl: "http://erp.local" },
    endpoints: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "ds-disabled": {
    id: "ds-disabled",
    name: "已禁用系统",
    type: "rest_api",
    enabled: false,
    auth: { type: "none" },
    config: {},
    endpoints: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

const mockDeps: BatchQueryDeps = {
  findById: async (id) => mockSources[id] ?? null,
  getAgentBindings: async () => [],
  getAdapter: () => ({
    query: async (_config: unknown, params: unknown) => ({
      success: true,
      data: { params, rows: [{ id: 1 }] },
    }),
  }),
}

describe("executeBatchQuery", () => {
  test("并行查询多个数据源成功", async () => {
    const result = await executeBatchQuery(
      [
        { datasourceId: "ds-1", endpointId: "ep-1", params: { date: "2024-01-01" } },
        { datasourceId: "ds-2", params: { type: "order" } },
      ],
      undefined,
      mockDeps,
    )

    expect(result.results).toHaveLength(2)
    expect(result.results[0].success).toBe(true)
    expect(result.results[0].datasourceName).toBe("MES系统")
    expect(result.results[1].success).toBe(true)
    expect(result.results[1].datasourceName).toBe("ERP系统")
  })

  test("数据源不存在返回错误", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "nonexistent", params: {} }],
      undefined,
      mockDeps,
    )

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("未找到")
  })

  test("禁用数据源返回错误", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "ds-disabled", params: {} }],
      undefined,
      mockDeps,
    )

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("已禁用")
  })

  test("合并 endpoint 默认参数", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "ds-1", endpointId: "ep-1", params: { date: "2024-01-01" } }],
      undefined,
      mockDeps,
    )

    expect(result.results[0].success).toBe(true)
    expect((result.results[0].data as { params: Record<string, unknown> }).params).toEqual({
      line: "A1",
      date: "2024-01-01",
    })
  })

  test("不存在的 endpointId 返回错误", async () => {
    const result = await executeBatchQuery(
      [{ datasourceId: "ds-1", endpointId: "bad-ep", params: {} }],
      undefined,
      mockDeps,
    )

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("未找到接口")
  })

  test("部分成功部分失败的混合结果", async () => {
    const result = await executeBatchQuery(
      [
        { datasourceId: "ds-1", params: {} },
        { datasourceId: "nonexistent", params: {} },
        { datasourceId: "ds-disabled", params: {} },
      ],
      undefined,
      mockDeps,
    )

    expect(result.results).toHaveLength(3)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[2].success).toBe(false)
  })

  test("权限检查 — 绑定限制", async () => {
    const restrictedDeps: BatchQueryDeps = {
      ...mockDeps,
      getAgentBindings: async () => ["ds-1"], // 只允许 ds-1
    }

    const result = await executeBatchQuery(
      [
        { datasourceId: "ds-1", params: {} },
        { datasourceId: "ds-2", params: {} },
      ],
      "agent-1",
      restrictedDeps,
    )

    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[1].error).toContain("无权访问")
  })

  test("adapter 不存在返回错误", async () => {
    const noAdapterDeps: BatchQueryDeps = {
      ...mockDeps,
      getAdapter: () => null,
    }

    const result = await executeBatchQuery(
      [{ datasourceId: "ds-1", params: {} }],
      undefined,
      noAdapterDeps,
    )

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain("不支持的数据源类型")
  })
})
