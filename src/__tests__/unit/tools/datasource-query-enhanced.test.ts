import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
vi.mock("@/db", () => ({ db: {} }))

const { mockFindById, mockGetAgentBindings, mockQuery } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockGetAgentBindings: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: class {
    findById = mockFindById
    getAgentBindings = mockGetAgentBindings
  },
}))

vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: vi.fn(() => ({ query: mockQuery })),
}))

import { datasourceQueryTool } from "@/mastra/tools/datasource"

const sampleConfig = {
  id: "ds-1",
  name: "MES 系统",
  type: "rest",
  auth: { type: "none" },
  config: { baseUrl: "http://mes.local" },
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
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("datasource-query — endpointId 增强", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindById.mockResolvedValue(sampleConfig)
    mockGetAgentBindings.mockResolvedValue([])
    mockQuery.mockResolvedValue({ success: true, data: { orders: [] } })
  })

  it("传入 endpointId 时自动合并 endpoint 默认参数", async () => {
    const result = await datasourceQueryTool.execute!(
      {
        datasourceId: "ds-1",
        endpointId: "get-orders",
        params: { query: { status: "pending" } },
      },
      {} as never,
    )

    expect(result.success).toBe(true)
    // 验证传给 adapter 的 params 是合并后的
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "GET",
        path: "/api/orders",
        query: { status: "pending" },
      }),
    )
  })

  it("用户参数覆盖 endpoint 默认参数", async () => {
    const result = await datasourceQueryTool.execute!(
      {
        datasourceId: "ds-1",
        endpointId: "get-orders",
        params: { method: "POST", query: { status: "done" } },
      },
      {} as never,
    )

    expect(result.success).toBe(true)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "POST", // 用户覆盖
        path: "/api/orders", // 来自 endpoint 默认
        query: { status: "done" },
      }),
    )
  })

  it("endpointId 不存在时返回错误", async () => {
    const result = await datasourceQueryTool.execute!(
      {
        datasourceId: "ds-1",
        endpointId: "non-existent",
        params: {},
      },
      {} as never,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("non-existent")
  })

  it("不传 endpointId 时行为不变（直接用 params）", async () => {
    const result = await datasourceQueryTool.execute!(
      {
        datasourceId: "ds-1",
        params: { method: "GET", path: "/custom" },
      },
      {} as never,
    )

    expect(result.success).toBe(true)
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), { method: "GET", path: "/custom" })
  })
})
