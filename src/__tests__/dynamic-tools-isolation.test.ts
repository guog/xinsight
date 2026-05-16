import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DatasourceRecord } from "@/db/repositories/datasource-repository"
import type { DatasourceEndpoint } from "@/mastra/tools/datasource/types"

const mockFindByAgentId = vi.fn<() => Promise<DatasourceRecord[]>>()
const mockGetAgentEndpointBindings =
  vi.fn<() => Promise<{ datasourceId: string; endpointIds: string[] | null }[]>>()

vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: class {
    findByAgentId = mockFindByAgentId
    getAgentEndpointBindings = mockGetAgentEndpointBindings
  },
}))

const mockQuery = vi.fn().mockResolvedValue({ success: true, data: [] })
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: vi.fn().mockReturnValue({ type: "rest", query: mockQuery }),
}))

vi.mock("@/db", () => ({ db: {} }))

function makeDatasource(overrides: Partial<DatasourceRecord> = {}): DatasourceRecord {
  return {
    id: "ds-1",
    name: "MES",
    description: null,
    type: "rest",
    auth: { type: "none" },
    config: { baseUrl: "https://mes.local" },
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

function makeEndpoint(id: string, name: string): DatasourceEndpoint {
  return {
    id,
    name,
    description: `${name}接口`,
    params: { method: "GET", path: `/api/${id}` },
    apiSchemaFormat: "natural",
  }
}

describe("动态工具权限隔离", () => {
  beforeEach(() => vi.clearAllMocks())

  async function build(agentId: string) {
    const { buildDynamicTools } = await import("@/mastra/tools/datasource/build-dynamic-tools")
    return buildDynamicTools(agentId)
  }

  it("Agent A 只能看到自己绑定的数据源端点", async () => {
    const ep1 = makeEndpoint("orders", "工单")
    const ep2 = makeEndpoint("quality", "质检")
    mockFindByAgentId.mockResolvedValue([makeDatasource({ id: "ds-mes", endpoints: [ep1, ep2] })])
    mockGetAgentEndpointBindings.mockResolvedValue([
      { datasourceId: "ds-mes", endpointIds: ["orders"] },
    ])

    const tools = await build("production-agent")
    expect(Object.keys(tools)).toEqual(["ds-mes--orders"])
    expect(tools["ds-mes--quality"]).toBeUndefined()
  })

  it("不同 Agent 获得不同工具集", async () => {
    // Agent A: 只绑定 orders
    mockFindByAgentId.mockResolvedValue([
      makeDatasource({
        id: "ds-1",
        endpoints: [makeEndpoint("orders", "工单"), makeEndpoint("quality", "质检")],
      }),
    ])
    mockGetAgentEndpointBindings.mockResolvedValue([
      { datasourceId: "ds-1", endpointIds: ["orders"] },
    ])
    const toolsA = await build("agent-a")

    // Agent B: 绑定全部（null = 全部）
    mockGetAgentEndpointBindings.mockResolvedValue([{ datasourceId: "ds-1", endpointIds: null }])
    const toolsB = await build("agent-b")

    expect(Object.keys(toolsA)).toEqual(["ds-1--orders"])
    expect(Object.keys(toolsB)).toEqual(["ds-1--orders", "ds-1--quality"])
  })

  it("跨数据源隔离：Agent 只看到绑定的数据源", async () => {
    mockFindByAgentId.mockResolvedValue([
      makeDatasource({ id: "ds-mes", endpoints: [makeEndpoint("ep1", "MES端点")] }),
    ])
    mockGetAgentEndpointBindings.mockResolvedValue([{ datasourceId: "ds-mes", endpointIds: null }])
    const tools = await build("agent-x")

    expect(Object.keys(tools)).toEqual(["ds-mes--ep1"])
    // ds-erp 不在 findByAgentId 返回中，自然看不到
  })

  it("无绑定的 Agent 工具集为空", async () => {
    mockFindByAgentId.mockResolvedValue([])
    mockGetAgentEndpointBindings.mockResolvedValue([])

    const tools = await build("unbound-agent")
    expect(tools).toEqual({})
  })

  it("endpointIds 为空数组时禁止所有端点", async () => {
    mockFindByAgentId.mockResolvedValue([
      makeDatasource({
        id: "ds-1",
        endpoints: [makeEndpoint("ep-1", "端点1"), makeEndpoint("ep-2", "端点2")],
      }),
    ])
    mockGetAgentEndpointBindings.mockResolvedValue([{ datasourceId: "ds-1", endpointIds: [] }])

    const tools = await build("restricted-agent")
    expect(tools).toEqual({})
  })
})
