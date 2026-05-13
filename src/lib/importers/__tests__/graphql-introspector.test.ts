import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { introspectGraphql } from "../graphql-introspector"

/** 模拟自省响应 */
const mockIntrospectionResponse = {
  data: {
    __schema: {
      queryType: { name: "Query" },
      mutationType: { name: "Mutation" },
      subscriptionType: null,
      types: [
        {
          name: "Query",
          kind: "OBJECT",
          fields: [
            {
              name: "users",
              description: "获取用户列表",
              args: [
                {
                  name: "limit",
                  type: { name: "Int", kind: "SCALAR", ofType: null },
                  defaultValue: null,
                },
                {
                  name: "offset",
                  type: {
                    name: null,
                    kind: "NON_NULL",
                    ofType: { name: "Int", kind: "SCALAR", ofType: null },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                name: null,
                kind: "LIST",
                ofType: { name: "User", kind: "OBJECT", ofType: null },
              },
            },
            {
              name: "post",
              description: null,
              args: [
                {
                  name: "id",
                  type: { name: "ID", kind: "SCALAR", ofType: null },
                  defaultValue: null,
                },
              ],
              type: { name: "Post", kind: "OBJECT", ofType: null },
            },
          ],
        },
        {
          name: "Mutation",
          kind: "OBJECT",
          fields: [
            {
              name: "createUser",
              description: "创建新用户",
              args: [
                {
                  name: "name",
                  type: { name: "String", kind: "SCALAR", ofType: null },
                  defaultValue: null,
                },
              ],
              type: { name: "User", kind: "OBJECT", ofType: null },
            },
          ],
        },
        {
          name: "User",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR", ofType: null } },
            { name: "name", type: { name: "String", kind: "SCALAR", ofType: null } },
            { name: "email", type: { name: "String", kind: "SCALAR", ofType: null } },
          ],
        },
        {
          name: "Post",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR", ofType: null } },
            { name: "title", type: { name: "String", kind: "SCALAR", ofType: null } },
          ],
        },
      ],
    },
  },
}

const originalFetch = globalThis.fetch
let mockFetchFn: ReturnType<typeof vi.fn>

beforeAll(() => {
  mockFetchFn = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(mockIntrospectionResponse), { status: 200 })),
  )
  globalThis.fetch = mockFetchFn as unknown as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

describe("introspectGraphql", () => {
  it("从 Query 类型中提取查询", async () => {
    const result = await introspectGraphql("http://example.com/graphql")
    expect(result.queries).toHaveLength(2)
    expect(result.queries[0].name).toBe("users")
    expect(result.queries[0].operationType).toBe("query")
    expect(result.queries[0].operationName).toBe("users")
    expect(result.queries[0].id).toBe("users")
    expect(result.queries[0].apiSchemaFormat).toBe("openapi")
    expect(result.queries[0].description).toBe("获取用户列表")
    expect(result.queries[1].name).toBe("post")
    expect(result.queries[1].description).toBeUndefined()
  })

  it("从 Mutation 类型中提取变更操作", async () => {
    const result = await introspectGraphql("http://example.com/graphql")
    expect(result.mutations).toHaveLength(1)
    expect(result.mutations[0].name).toBe("createUser")
    expect(result.mutations[0].operationType).toBe("mutation")
    expect(result.mutations[0].description).toBe("创建新用户")
  })

  it("处理空 schema（无订阅）", async () => {
    const result = await introspectGraphql("http://example.com/graphql")
    expect(result.subscriptions).toHaveLength(0)
  })

  it("生成包含参数的正确查询字符串", async () => {
    const result = await introspectGraphql("http://example.com/graphql")
    const usersQuery = result.queries[0]
    // 应包含变量声明和参数传递
    expect(usersQuery.query).toContain("$limit: Int")
    expect(usersQuery.query).toContain("$offset: Int!")
    expect(usersQuery.query).toContain("limit: $limit")
    expect(usersQuery.query).toContain("offset: $offset")
    // 应包含返回字段
    expect(usersQuery.query).toContain("id")
    expect(usersQuery.query).toContain("name")
    expect(usersQuery.query).toContain("email")
    // variables 应为 JSON schema
    expect(usersQuery.variables).toBe(JSON.stringify({ limit: "Int", offset: "Int!" }))
  })

  it("传递自定义请求头", async () => {
    await introspectGraphql("http://example.com/graphql", { Authorization: "Bearer token123" })
    const lastCall = mockFetchFn.mock.calls[mockFetchFn.mock.calls.length - 1]
    const headers = lastCall[1].headers
    expect(headers.Authorization).toBe("Bearer token123")
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("非 200 响应时抛出错误", async () => {
    const savedFetch = globalThis.fetch
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" })),
    ) as unknown as typeof fetch
    try {
      await expect(introspectGraphql("http://example.com/graphql")).rejects.toThrow("404")
    } finally {
      globalThis.fetch = savedFetch
    }
  })

  it("无效自省响应时抛出错误", async () => {
    const savedFetch = globalThis.fetch
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 })),
    ) as unknown as typeof fetch
    try {
      await expect(introspectGraphql("http://example.com/graphql")).rejects.toThrow("__schema")
    } finally {
      globalThis.fetch = savedFetch
    }
  })

  it("处理完全空的 schema", async () => {
    const savedFetch = globalThis.fetch
    const emptySchema = {
      data: {
        __schema: {
          queryType: null,
          mutationType: null,
          subscriptionType: null,
          types: [],
        },
      },
    }
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(emptySchema), { status: 200 })),
    ) as unknown as typeof fetch
    try {
      const result = await introspectGraphql("http://example.com/graphql")
      expect(result.queries).toHaveLength(0)
      expect(result.mutations).toHaveLength(0)
      expect(result.subscriptions).toHaveLength(0)
    } finally {
      globalThis.fetch = savedFetch
    }
  })
})
