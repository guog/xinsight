import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock db
const mockGetBinding = vi.fn()
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: mockGetBinding,
      })),
    })),
  })),
}
vi.mock("@/db", () => ({
  db: mockDb,
}))

// Mock auth
const mockRequireAuth = vi.fn()
vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
    handleAuthError: (error: unknown) => {
      if (error instanceof Error && error.message === "未登录") {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
      }
      return null
    },
  }
})

// Mock repositories
const mockGetAuthorizedAgentsForUser = vi.fn()
vi.mock("@/db/repositories/agent-repository", () => ({
  SqliteAgentRepository: class {
    getAuthorizedAgentsForUser(...args: any[]) {
      return mockGetAuthorizedAgentsForUser(...args)
    }
  },
}))

const mockFindById = vi.fn()
const mockRecordCall = vi.fn()
vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: class {
    findById(...args: any[]) {
      return mockFindById(...args)
    }
    recordCall(...args: any[]) {
      return mockRecordCall(...args)
    }
  },
}))

// Mock adapters
const mockQuery = vi.fn()
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: () => ({
    query: mockQuery,
  }),
}))

// 动态载入 API
const { POST } = await import("@/app/api/datasources/execute-write/route")

describe("POST /api/datasources/execute-write", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockGetAuthorizedAgentsForUser.mockReset()
    mockGetBinding.mockReset()
    mockFindById.mockReset()
    mockRecordCall.mockReset()
    mockQuery.mockReset()

    // 默认通过登录
    mockRequireAuth.mockResolvedValue({ id: "user-1", role: "user" })
    // 默认授权该 Agent
    mockGetAuthorizedAgentsForUser.mockResolvedValue([{ id: "chatAgent", name: "聊天助手" }])
    // 默认配置好数据源关联及确认列表
    mockGetBinding.mockReturnValue({
      agentId: "chatAgent",
      datasourceId: "ds-1",
      endpointIds: JSON.stringify(["write-orders"]),
      confirmationRequiredEndpoints: JSON.stringify(["write-orders"]),
    })
    // 默认找到数据源
    mockFindById.mockResolvedValue({
      id: "ds-1",
      name: "MES系统",
      type: "rest",
      enabled: true,
      auth: {},
      config: {},
      endpoints: [
        {
          id: "write-orders",
          name: "创建订单",
          method: "POST",
          params: {},
        },
        {
          id: "get-orders",
          name: "查询订单",
          method: "GET",
          params: {},
        },
      ],
    })
    // 默认执行成功
    mockQuery.mockResolvedValue({ success: true, result: "订单创建成功" })
  })

  it("未登录时返回 401", async () => {
    mockRequireAuth.mockRejectedValue(new Error("未登录"))
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  it("缺少必要参数时返回 400", async () => {
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        datasourceId: "ds-1",
        endpointId: "write-orders",
      }), // 缺少 agentId
    })
    const response = await POST(req)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("缺少必要参数")
  })

  it("用户无权访问该 Agent 时返回 403", async () => {
    mockGetAuthorizedAgentsForUser.mockResolvedValue([{ id: "otherAgent" }]) // 用户只被授权了 otherAgent
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        agentId: "chatAgent",
        datasourceId: "ds-1",
        endpointId: "write-orders",
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe("您无权访问该 Agent")
  })

  it("Agent 没有配置该数据源时返回 403", async () => {
    mockGetBinding.mockReturnValue(null) // 未关联该数据源
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        agentId: "chatAgent",
        datasourceId: "ds-1",
        endpointId: "write-orders",
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe("该 Agent 未配置此数据源访问权限")
  })

  it("该端点不在确认列表中时返回 403 拒绝直接调用", async () => {
    mockGetBinding.mockReturnValue({
      agentId: "chatAgent",
      datasourceId: "ds-1",
      endpointIds: JSON.stringify(["write-orders"]),
      confirmationRequiredEndpoints: JSON.stringify([]), // 确认列表为空
    })
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        agentId: "chatAgent",
        datasourceId: "ds-1",
        endpointId: "write-orders",
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toContain("禁止直接通过 execute-write 接口调用")
  })

  it("调用 GET 类型的端点时返回 400 拒绝操作", async () => {
    // 强制把 get-orders 设为需要确认 (一般不会有，但防止绕过)
    mockGetBinding.mockReturnValue({
      agentId: "chatAgent",
      datasourceId: "ds-1",
      endpointIds: JSON.stringify(["get-orders"]),
      confirmationRequiredEndpoints: JSON.stringify(["get-orders"]),
    })
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        agentId: "chatAgent",
        datasourceId: "ds-1",
        endpointId: "get-orders",
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("仅支持非 GET 类型的写操作端点")
  })

  it("数据源不存在或已被禁用时返回相应错误", async () => {
    mockFindById.mockResolvedValue(null) // 数据源未找到
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        agentId: "chatAgent",
        datasourceId: "ds-1",
        endpointId: "write-orders",
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(404)
  })

  it("全部校验通过后成功执行并记录调用次数", async () => {
    const req = new Request("http://localhost/api/datasources/execute-write", {
      method: "POST",
      body: JSON.stringify({
        agentId: "chatAgent",
        datasourceId: "ds-1",
        endpointId: "write-orders",
        params: { orderId: "123" },
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.result).toBe("订单创建成功")
    expect(mockQuery).toHaveBeenCalled()
    expect(mockRecordCall).toHaveBeenCalledWith("ds-1")
  })
})
