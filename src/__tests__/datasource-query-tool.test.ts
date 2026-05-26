import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRepo, mockGetAdapter } = vi.hoisted(() => {
  const mockRepo = {
    findById: vi.fn(),
    getAgentEndpointBindings: vi.fn(),
    findByAgentId: vi.fn(),
    findAllEnabled: vi.fn(),
  }
  const mockGetAdapter = vi.fn()
  return { mockRepo, mockGetAdapter }
})

vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: function () {
    return mockRepo
  },
}))
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: mockGetAdapter,
}))

import { datasourceQueryTool, datasourceListTool } from "@/mastra/tools/datasource/index"

describe("datasourceQueryTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const execute = (datasourceQueryTool as any).execute.bind(datasourceQueryTool)

  it("数据源不存在返回错误", async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await execute({ datasourceId: "ds1", params: {} }, { agentId: "agent1" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("未找到")
  })

  it("数据源已禁用返回错误", async () => {
    mockRepo.findById.mockResolvedValue({ id: "ds1", name: "Test", enabled: false })
    const result = await execute({ datasourceId: "ds1", params: {} }, { agentId: "agent1" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("已禁用")
  })

  it("缺少 Agent 上下文返回错误", async () => {
    mockRepo.findById.mockResolvedValue({ id: "ds1", name: "Test", enabled: true })
    const result = await execute({ datasourceId: "ds1", params: {} }, {})
    expect(result.success).toBe(false)
    expect(result.error).toContain("缺少 Agent 上下文")
  })

  it("Agent 无权访问返回错误", async () => {
    mockRepo.findById.mockResolvedValue({ id: "ds1", name: "Test", enabled: true })
    mockRepo.getAgentEndpointBindings.mockResolvedValue([
      { datasourceId: "other-ds", endpointIds: null },
    ])
    const result = await execute({ datasourceId: "ds1", params: {} }, { agentId: "agent1" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("无权访问")
  })

  it("端点级权限拒绝", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "ds1",
      name: "Test",
      enabled: true,
      endpoints: [{ id: "ep1", params: {} }],
    })
    mockRepo.getAgentEndpointBindings.mockResolvedValue([
      { datasourceId: "ds1", endpointIds: ["ep2"] },
    ])
    const result = await execute(
      { datasourceId: "ds1", endpointId: "ep1", params: {} },
      { agentId: "agent1" },
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain("无权访问")
    expect(result.error).toContain("ep1")
  })

  it("endpoint 不存在返回错误", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "ds1",
      name: "Test",
      enabled: true,
      endpoints: [{ id: "ep1", params: {} }],
    })
    mockRepo.getAgentEndpointBindings.mockResolvedValue([])
    const result = await execute(
      { datasourceId: "ds1", endpointId: "ep-missing", params: {} },
      { agentId: "agent1" },
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain("未找到接口")
  })

  it("不支持的数据源类型返回错误", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "ds1",
      name: "Test",
      type: "unknown",
      enabled: true,
    })
    mockRepo.getAgentEndpointBindings.mockResolvedValue([])
    mockGetAdapter.mockReturnValue(null)
    const result = await execute({ datasourceId: "ds1", params: {} }, { agentId: "agent1" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("不支持的数据源类型")
  })

  it("成功查询调用 adapter", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "ds1",
      name: "Test",
      type: "rest",
      enabled: true,
      auth: null,
      config: {},
      endpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockRepo.getAgentEndpointBindings.mockResolvedValue([])
    const mockAdapter = { query: vi.fn().mockResolvedValue({ success: true, data: [1, 2] }) }
    mockGetAdapter.mockReturnValue(mockAdapter)
    const result = await execute(
      { datasourceId: "ds1", params: { key: "val" } },
      { agentId: "agent1" },
    )
    expect(result.success).toBe(true)
    expect(mockAdapter.query).toHaveBeenCalled()
  })

  it("参数校验失败返回错误提示", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "ds1",
      name: "Test",
      type: "rest",
      enabled: true,
      endpoints: [
        {
          id: "ep1",
          params: {},
          structuredParams: [{ name: "count", type: "number", required: true }],
        },
      ],
    })
    mockRepo.getAgentEndpointBindings.mockResolvedValue([])
    const result = await execute(
      { datasourceId: "ds1", endpointId: "ep1", params: {} },
      { agentId: "agent1" },
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain("参数校验失败")
  })
})

describe("datasourceListTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const execute = (datasourceListTool as any).execute.bind(datasourceListTool)

  it("列出 Agent 绑定的数据源", async () => {
    mockRepo.getAgentEndpointBindings.mockResolvedValue([])
    mockRepo.findByAgentId.mockResolvedValue([
      { id: "ds1", name: "MES", type: "rest", description: "MES系统", endpoints: [] },
    ])
    const result = await execute({}, { agentId: "agent1" })
    expect(result.datasources).toHaveLength(1)
    expect(result.datasources[0].name).toBe("MES")
  })

  it("无 agentId 列出所有启用的数据源", async () => {
    mockRepo.findAllEnabled.mockResolvedValue([
      { id: "ds1", name: "MES", type: "rest", description: null, endpoints: [] },
    ])
    const result = await execute({}, {})
    expect(result.datasources).toHaveLength(1)
  })

  it("展示 endpoints 含 structuredParams", async () => {
    mockRepo.getAgentEndpointBindings.mockResolvedValue([])
    mockRepo.findByAgentId.mockResolvedValue([
      {
        id: "ds1",
        name: "MES",
        type: "rest",
        description: null,
        endpoints: [
          {
            id: "ep1",
            name: "查询",
            description: "查询接口",
            params: {},
            structuredParams: [{ name: "startDate", type: "date", required: true }],
          },
        ],
      },
    ])
    const result = await execute({}, { resourceId: "agent1" })
    expect(result.datasources).toHaveLength(1)
    expect(result.datasources[0].endpoints.length).toBeGreaterThan(0)
  })

  it("按端点绑定过滤 endpoints", async () => {
    mockRepo.getAgentEndpointBindings.mockResolvedValue([
      { datasourceId: "ds1", endpointIds: ["ep2"] },
    ])
    mockRepo.findByAgentId.mockResolvedValue([
      {
        id: "ds1",
        name: "MES",
        type: "rest",
        description: null,
        endpoints: [
          { id: "ep1", name: "A", description: "A", params: {} },
          { id: "ep2", name: "B", description: "B", params: {} },
        ],
      },
    ])
    const result = await execute({}, { agentId: "agent1" })
    expect(result.datasources[0].endpoints).toHaveLength(1)
    expect(result.datasources[0].endpoints[0].id).toBe("ep2")
  })
})
