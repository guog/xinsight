import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DatasourceRecord } from "@/db/repositories/datasource-repository"
import type { DatasourceEndpoint } from "@/mastra/tools/datasource/types"

// Mock datasource-repository
const mockFindByAgentId = vi.fn<() => Promise<DatasourceRecord[]>>()
const mockGetAgentEndpointBindings =
  vi.fn<() => Promise<{ datasourceId: string; endpointIds: string[] | null }[]>>()
vi.mock("@/db/repositories/datasource-repository", () => {
  return {
    SqliteDatasourceRepository: class {
      findByAgentId = mockFindByAgentId
      getAgentEndpointBindings = mockGetAgentEndpointBindings
    },
  }
})

// Mock adapter
const mockQuery = vi.fn().mockResolvedValue({ success: true, data: { items: [] } })
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: vi.fn().mockReturnValue({ type: "rest", query: mockQuery }),
}))

vi.mock("@/db", () => ({ db: {} }))

function makeDatasource(overrides: Partial<DatasourceRecord> = {}): DatasourceRecord {
  return {
    id: "ds-1",
    name: "测试数据源",
    description: "测试用",
    type: "rest",
    auth: { type: "none" },
    config: { baseUrl: "https://example.com" },
    endpoints: [],
    enabled: true,
    lastTestedAt: null,
    lastTestResult: null,
    lastTestMessage: null,
    lastCalledAt: null,
    callCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeEndpoint(overrides: Partial<DatasourceEndpoint> = {}): DatasourceEndpoint {
  return {
    id: "ep-1",
    name: "获取工单列表",
    description: "查询生产工单",
    params: { method: "GET", path: "/api/orders" },
    apiSchemaFormat: "natural",
    ...overrides,
  }
}

describe("buildDynamicTools", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function importBuild() {
    const mod = await import("@/mastra/tools/datasource/build-dynamic-tools")
    return mod.buildDynamicTools
  }

  it("无绑定时返回空对象", async () => {
    mockFindByAgentId.mockResolvedValue([])
    mockGetAgentEndpointBindings.mockResolvedValue([])
    const buildDynamicTools = await importBuild()
    const tools = await buildDynamicTools("agent-1")
    expect(tools).toEqual({})
  })

  it("为每个绑定的 endpoint 生成一个工具", async () => {
    const ep1 = makeEndpoint({ id: "ep-1", name: "工单列表" })
    const ep2 = makeEndpoint({ id: "ep-2", name: "工单详情" })
    mockFindByAgentId.mockResolvedValue([makeDatasource({ endpoints: [ep1, ep2] })])
    mockGetAgentEndpointBindings.mockResolvedValue([{ datasourceId: "ds-1", endpointIds: null }])
    const buildDynamicTools = await importBuild()
    const tools = await buildDynamicTools("agent-1")
    expect(Object.keys(tools)).toHaveLength(2)
    expect(tools["ds-1--ep-1"]).toBeDefined()
    expect(tools["ds-1--ep-2"]).toBeDefined()
  })

  it("按 endpointIds 过滤端点", async () => {
    const ep1 = makeEndpoint({ id: "ep-1" })
    const ep2 = makeEndpoint({ id: "ep-2" })
    mockFindByAgentId.mockResolvedValue([makeDatasource({ endpoints: [ep1, ep2] })])
    mockGetAgentEndpointBindings.mockResolvedValue([
      { datasourceId: "ds-1", endpointIds: ["ep-1"] },
    ])
    const buildDynamicTools = await importBuild()
    const tools = await buildDynamicTools("agent-1")
    expect(Object.keys(tools)).toEqual(["ds-1--ep-1"])
  })

  it("上限 20 个工具", async () => {
    const endpoints = Array.from({ length: 25 }, (_, i) =>
      makeEndpoint({ id: `ep-${i}`, name: `端点${i}` }),
    )
    mockFindByAgentId.mockResolvedValue([makeDatasource({ endpoints })])
    mockGetAgentEndpointBindings.mockResolvedValue([{ datasourceId: "ds-1", endpointIds: null }])
    const buildDynamicTools = await importBuild()
    const tools = await buildDynamicTools("agent-1")
    expect(Object.keys(tools).length).toBeLessThanOrEqual(20)
  })

  it("生成的工具可执行并调用 adapter", async () => {
    const ep = makeEndpoint({
      id: "ep-1",
      params: { method: "GET", path: "/api/orders" },
      structuredParams: [
        { name: "status", type: "string", required: false, description: "工单状态" },
      ],
    })
    mockFindByAgentId.mockResolvedValue([makeDatasource({ endpoints: [ep] })])
    mockGetAgentEndpointBindings.mockResolvedValue([{ datasourceId: "ds-1", endpointIds: null }])
    const buildDynamicTools = await importBuild()
    const tools = await buildDynamicTools("agent-1")
    const tool = tools["ds-1--ep-1"]
    expect(tool).toBeDefined()
    // 调用工具的 execute
    const result = await tool.execute!({ params: { status: "active" } }, {} as never)
    expect(mockQuery).toHaveBeenCalled()
    expect(result).toEqual({ success: true, data: { items: [] } })
  })
})
