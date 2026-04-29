import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RestAdapter } from "../rest-adapter"
import type { DatasourceConfig } from "../../types"

/** 构造测试用数据源配置 */
function makeConfig(overrides: Partial<DatasourceConfig> = {}): DatasourceConfig {
  return {
    id: "ds-1",
    name: "测试数据源",
    type: "rest",
    auth: { type: "none" },
    config: { baseUrl: "https://api.example.com", timeout: 5000 },
    endpoints: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("RestAdapter", () => {
  let adapter: RestAdapter
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new RestAdapter()
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("type 应为 rest", () => {
    expect(adapter.type).toBe("rest")
  })

  it("GET 请求正常工作", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    const result = await adapter.query(makeConfig(), { path: "/users/1", method: "GET" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: 1 })
    expect(result.metadata?.datasourceId).toBe("ds-1")
    expect(result.metadata?.datasourceName).toBe("测试数据源")
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://api.example.com/users/1")
    expect(opts.method).toBe("GET")
  })

  it("POST 请求携带 body", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }))

    const body = { name: "test" }
    const result = await adapter.query(makeConfig(), { path: "/users", method: "POST", body })

    expect(result.success).toBe(true)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe("POST")
    expect(opts.body).toBe(JSON.stringify(body))
  })

  it("GET 请求携带 query 参数", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    await adapter.query(makeConfig(), {
      path: "/users",
      method: "GET",
      query: { page: "1", size: "10" },
    })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe("https://api.example.com/users?page=1&size=10")
  })

  it("Bearer 认证注入 Authorization 头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({ auth: { type: "bearer", token: "my-token" } })
    await adapter.query(config, { path: "/data", method: "GET" })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["Authorization"]).toBe("Bearer my-token")
  })

  it("Basic 认证注入编码后的头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({ auth: { type: "basic", username: "user", password: "pass" } })
    await adapter.query(config, { path: "/data", method: "GET" })

    const [, opts] = mockFetch.mock.calls[0]
    const encoded = btoa("user:pass")
    expect(opts.headers["Authorization"]).toBe(`Basic ${encoded}`)
  })

  it("API Key 认证注入自定义头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({
      auth: { type: "apikey", key: "X-API-Key", value: "secret", in: "header" },
    })
    await adapter.query(config, { path: "/data", method: "GET" })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["X-API-Key"]).toBe("secret")
  })

  it("API Key 认证放入 query 参数", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({
      auth: { type: "apikey", key: "api_key", value: "secret", in: "query" },
    })
    await adapter.query(config, { path: "/data", method: "GET" })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain("api_key=secret")
  })

  it("HTTP 错误返回 success=false", async () => {
    mockFetch.mockResolvedValue(new Response("Not Found", { status: 404, statusText: "Not Found" }))

    const result = await adapter.query(makeConfig(), { path: "/missing", method: "GET" })

    expect(result.success).toBe(false)
    expect(result.error).toContain("404")
  })

  it("网络错误返回 success=false", async () => {
    mockFetch.mockRejectedValue(new Error("fetch failed"))

    const result = await adapter.query(makeConfig(), { path: "/data", method: "GET" })

    expect(result.success).toBe(false)
    expect(result.error).toContain("fetch failed")
  })

  it("testConnection 成功", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(true)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://api.example.com")
    expect(opts.method).toBe("HEAD")
  })

  it("testConnection 失败", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(false)
    expect(result.message).toContain("connection refused")
  })

  it("响应过大时返回 success=false", async () => {
    const headers = new Headers({ "content-length": "6000000" })
    mockFetch.mockResolvedValue(new Response("{}", { status: 200, headers }))

    const result = await adapter.query(makeConfig(), { path: "/big", method: "GET" })

    expect(result.success).toBe(false)
    expect(result.error).toContain("5MB")
  })

  it("超时时返回 success=false", async () => {
    mockFetch.mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
    )

    const config = makeConfig({
      config: { baseUrl: "https://api.example.com", timeout: 100 },
    } as unknown as Parameters<typeof makeConfig>[0])
    const result = await adapter.query(config, { path: "/slow", method: "GET" })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  describe("endpoint 字段解析", () => {
    it("通过 endpointId 查找 endpoint 并使用 method/path", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

      const config = makeConfig({
        endpoints: [
          {
            id: "ep-1",
            name: "获取用户",
            description: "根据ID获取用户",
            params: {},
            apiSchemaFormat: "natural",
            method: "GET",
            path: "/users/{userId}",
            queryParams: { fields: "name,email" },
            headers: { "X-Custom": "value" },
          },
        ] as unknown[],
      })

      const result = await adapter.query(config, { endpointId: "ep-1", userId: "42" })

      expect(result.success).toBe(true)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain("/users/42")
      expect(url).toContain("fields=name%2Cemail")
      expect(opts.method).toBe("GET")
      expect(opts.headers["X-Custom"]).toBe("value")
    })

    it("endpoint queryParams 与 params.query 合并，params 优先", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

      const config = makeConfig({
        endpoints: [
          {
            id: "ep-2",
            name: "列表",
            description: "列表",
            params: {},
            apiSchemaFormat: "natural",
            method: "GET",
            path: "/items",
            queryParams: { page: "1", size: "10" },
          },
        ] as unknown[],
      })

      await adapter.query(config, { endpointId: "ep-2", query: { page: "2" } })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("page=2")
      expect(url).toContain("size=10")
    })

    it("endpointId 找不到时回退到 params", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

      await adapter.query(makeConfig(), {
        endpointId: "nonexistent",
        path: "/fallback",
        method: "GET",
      })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.example.com/fallback")
    })
  })
})
