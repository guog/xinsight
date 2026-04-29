import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { OpcuaAdapter } from "../opcua-adapter"
import type { DatasourceConfig } from "../../types"

/** 构造测试用 OPC UA 数据源配置 */
function makeConfig(overrides: Partial<DatasourceConfig> = {}): DatasourceConfig {
  return {
    id: "ds-opcua-1",
    name: "测试OPC UA网关",
    type: "opcua",
    auth: { type: "none" },
    config: { endpointUrl: "https://opcua-gateway.example.com/api", timeout: 5000 },
    endpoints: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("OpcuaAdapter", () => {
  let adapter: OpcuaAdapter
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new OpcuaAdapter()
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("type 应为 opcua", () => {
    expect(adapter.type).toBe("opcua")
  })

  it("读取节点成功", async () => {
    const responseData = [
      { nodeId: "ns=2;s=Temperature", value: 23.5 },
      { nodeId: "ns=2;s=Pressure", value: 101.3 },
    ]
    mockFetch.mockResolvedValue(new Response(JSON.stringify(responseData), { status: 200 }))

    const result = await adapter.query(makeConfig(), {
      action: "read",
      nodeIds: ["ns=2;s=Temperature", "ns=2;s=Pressure"],
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(responseData)
    expect(result.metadata?.datasourceId).toBe("ds-opcua-1")

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://opcua-gateway.example.com/api")
    expect(opts.method).toBe("POST")
    const body = JSON.parse(opts.body)
    expect(body.action).toBe("read")
    expect(body.nodeIds).toEqual(["ns=2;s=Temperature", "ns=2;s=Pressure"])
  })

  it("浏览节点成功", async () => {
    const responseData = {
      nodeId: "i=85",
      children: [{ nodeId: "ns=2;s=Device1", displayName: "设备1" }],
    }
    mockFetch.mockResolvedValue(new Response(JSON.stringify(responseData), { status: 200 }))

    const result = await adapter.query(makeConfig(), {
      action: "browse",
      nodeId: "i=85",
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(responseData)

    const [, opts] = mockFetch.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.action).toBe("browse")
    expect(body.nodeId).toBe("i=85")
  })

  it("Bearer 认证注入 Authorization 头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({ auth: { type: "bearer", token: "opcua-token" } })
    await adapter.query(config, { action: "read", nodeIds: ["ns=2;s=T"] })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["Authorization"]).toBe("Bearer opcua-token")
  })

  it("HTTP 错误返回 success=false", async () => {
    mockFetch.mockResolvedValue(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
    )

    const result = await adapter.query(makeConfig(), {
      action: "read",
      nodeIds: ["ns=2;s=T"],
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("500")
  })

  it("testConnection 成功", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ nodeId: "i=84", children: [] }), { status: 200 }),
    )

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(true)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://opcua-gateway.example.com/api")
    expect(opts.method).toBe("POST")
    const body = JSON.parse(opts.body)
    expect(body.action).toBe("browse")
    expect(body.nodeId).toBe("i=84")
  })

  it("testConnection 失败", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(false)
    expect(result.message).toContain("connection refused")
  })
})
