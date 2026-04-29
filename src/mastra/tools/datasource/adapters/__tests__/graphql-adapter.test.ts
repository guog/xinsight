import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { GraphqlAdapter } from "../graphql-adapter"
import type { DatasourceConfig } from "../../types"

/** 构造测试用数据源配置 */
function makeConfig(auth: DatasourceConfig["auth"] = { type: "none" }): DatasourceConfig {
  return {
    id: "ds-1",
    name: "测试 GraphQL",
    type: "graphql",
    auth,
    config: { endpoint: "https://api.example.com/graphql" },
    endpoints: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe("GraphqlAdapter", () => {
  let adapter: GraphqlAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new GraphqlAdapter()
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("type 应为 graphql", () => {
    expect(adapter.type).toBe("graphql")
  })

  it("成功发送 GraphQL 查询并返回 data", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { users: [{ id: 1 }] } })))

    const result = await adapter.query(makeConfig(), { query: "{ users { id } }" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ users: [{ id: 1 }] })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/graphql",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "{ users { id } }" }),
      }),
    )
  })

  it("发送带 variables 和 operationName 的查询", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { user: { name: "张三" } } })))

    const params = {
      query: "query GetUser($id: ID!) { user(id: $id) { name } }",
      variables: { id: "1" },
      operationName: "GetUser",
    }
    const result = await adapter.query(makeConfig(), params)

    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/graphql",
      expect.objectContaining({
        body: JSON.stringify(params),
      }),
    )
  })

  it("GraphQL errors 数组返回 success=false", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "字段不存在" }] })),
    )

    const result = await adapter.query(makeConfig(), { query: "{ bad }" })

    expect(result.success).toBe(false)
    expect(result.error).toContain("字段不存在")
  })

  it("HTTP 错误返回 success=false", async () => {
    fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }))

    const result = await adapter.query(makeConfig(), { query: "{ users { id } }" })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("Bearer 认证注入 Authorization 头", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { me: {} } })))

    await adapter.query(makeConfig({ type: "bearer", token: "tok_123" }), {
      query: "{ me { id } }",
    })

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers["Authorization"]).toBe("Bearer tok_123")
  })

  it("testConnection 发送 __typename 查询", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { __typename: "Query" } })))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/graphql",
      expect.objectContaining({
        body: JSON.stringify({ query: "{ __typename }" }),
      }),
    )
  })

  it("testConnection 失败时返回 ok=false", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "无权限" }] })))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(false)
    expect(result.message).toContain("无权限")
  })

  describe("endpoint 字段解析", () => {
    it("通过 endpointId 使用 endpoint 的 query 和 operationName", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { user: { id: "1" } } })))

      const config = makeConfig()
      config.endpoints = [
        {
          id: "ep-1",
          name: "获取用户",
          description: "获取用户",
          params: {},
          apiSchemaFormat: "natural",
          query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
          operationName: "GetUser",
        },
      ] as any

      const result = await adapter.query(config, { endpointId: "ep-1", variables: { id: "1" } })

      expect(result.success).toBe(true)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.query).toBe("query GetUser($id: ID!) { user(id: $id) { id name } }")
      expect(body.operationName).toBe("GetUser")
      expect(body.variables).toEqual({ id: "1" })
    })

    it("endpointId 找不到时回退到 params", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } })))

      const result = await adapter.query(makeConfig(), { endpointId: "missing", query: "{ ok }" })

      expect(result.success).toBe(true)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.query).toBe("{ ok }")
    })
  })
})
