import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { GrpcAdapter } from "../grpc-adapter"
import type { DatasourceConfig } from "../../types"

/** 构造测试用 gRPC 数据源配置 */
function makeConfig(overrides: Partial<DatasourceConfig> = {}): DatasourceConfig {
  return {
    id: "ds-grpc-1",
    name: "测试gRPC数据源",
    type: "grpc",
    auth: { type: "none" },
    config: { address: "https://grpc-gateway.example.com", timeout: 5000 },
    endpoints: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("GrpcAdapter", () => {
  let adapter: GrpcAdapter
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new GrpcAdapter()
    mockFetch = vi.fn()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("type 应为 grpc", () => {
    expect(adapter.type).toBe("grpc")
  })

  it("发送 gRPC 查询成功（service + method + message）", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ result: "ok" }), { status: 200 }))

    const result = await adapter.query(makeConfig(), {
      service: "UserService",
      method: "GetUser",
      message: { id: 1 },
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ result: "ok" })
    expect(result.metadata?.datasourceId).toBe("ds-grpc-1")
    expect(result.metadata?.duration).toBeGreaterThanOrEqual(0)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://grpc-gateway.example.com")
    expect(opts.method).toBe("POST")
    expect(JSON.parse(opts.body)).toEqual({
      service: "UserService",
      method: "GetUser",
      message: { id: 1 },
    })
  })

  it("认证头被注入", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({ auth: { type: "bearer", token: "grpc-token" } })
    await adapter.query(config, { service: "Svc", method: "Call", message: {} })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["Authorization"]).toBe("Bearer grpc-token")
  })

  it("HTTP 错误返回 success=false", async () => {
    mockFetch.mockResolvedValue(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
    )

    const result = await adapter.query(makeConfig(), {
      service: "Svc",
      method: "Call",
      message: {},
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("500")
  })

  it("网络错误返回 success=false", async () => {
    mockFetch.mockRejectedValue(new Error("network error"))

    const result = await adapter.query(makeConfig(), {
      service: "Svc",
      method: "Call",
      message: {},
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("network error")
  })

  it("testConnection 成功", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(true)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://grpc-gateway.example.com")
    expect(opts.method).toBe("POST")
  })

  it("testConnection 失败", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(false)
    expect(result.message).toContain("connection refused")
  })
})
