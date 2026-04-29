import { describe, it, expect, vi, beforeEach } from "vitest"
import { introspectGraphql, graphqlTypeToFields } from "./graphql-introspector"

describe("graphqlTypeToFields", () => {
  const typeMap = new Map<string, unknown>()
  typeMap.set("User", {
    name: "User",
    kind: "OBJECT",
    fields: [
      { name: "id", type: { kind: "SCALAR", name: "ID" } },
      { name: "name", type: { kind: "SCALAR", name: "String" } },
      { name: "age", type: { kind: "SCALAR", name: "Int" } },
      { name: "active", type: { kind: "SCALAR", name: "Boolean" } },
    ],
  })

  it("处理 SCALAR 类型", () => {
    const result = graphqlTypeToFields({ kind: "SCALAR", name: "String" }, typeMap)
    expect(result).toEqual([{ name: "String", type: "string" }])
  })

  it("处理 OBJECT 类型", () => {
    const result = graphqlTypeToFields({ kind: "OBJECT", name: "User" }, typeMap)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({ name: "id", type: "string", description: undefined })
    expect(result[2]).toEqual({ name: "age", type: "number", description: undefined })
    expect(result[3]).toEqual({ name: "active", type: "boolean", description: undefined })
  })

  it("处理 NON_NULL 包装", () => {
    const result = graphqlTypeToFields(
      { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "Int" } },
      typeMap,
    )
    expect(result).toEqual([{ name: "Int", type: "number" }])
  })

  it("处理 LIST 类型", () => {
    const result = graphqlTypeToFields(
      { kind: "LIST", ofType: { kind: "SCALAR", name: "String" } },
      typeMap,
    )
    expect(result).toEqual([
      { name: "items", type: "array", children: [{ name: "String", type: "string" }] },
    ])
  })

  it("尊重 maxDepth 限制", () => {
    const result = graphqlTypeToFields({ kind: "OBJECT", name: "User" }, typeMap, 0)
    expect(result).toEqual([])
  })
})

describe("introspectGraphql responseSchema", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("生成的 endpoint 包含 responseSchema", async () => {
    const mockSchema = {
      data: {
        __schema: {
          queryType: { name: "Query" },
          mutationType: null,
          subscriptionType: null,
          types: [
            {
              name: "Query",
              kind: "OBJECT",
              fields: [
                {
                  name: "user",
                  description: "获取用户",
                  args: [{ name: "id", type: { kind: "SCALAR", name: "ID" }, defaultValue: null }],
                  type: { kind: "OBJECT", name: "User", ofType: null },
                },
              ],
            },
            {
              name: "User",
              kind: "OBJECT",
              fields: [
                {
                  name: "id",
                  description: null,
                  args: [],
                  type: { kind: "SCALAR", name: "ID", ofType: null },
                },
                {
                  name: "name",
                  description: null,
                  args: [],
                  type: { kind: "SCALAR", name: "String", ofType: null },
                },
                {
                  name: "score",
                  description: null,
                  args: [],
                  type: { kind: "SCALAR", name: "Float", ofType: null },
                },
              ],
            },
          ],
        },
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSchema),
    }) as unknown

    const result = await introspectGraphql("http://localhost/graphql")
    expect(result.queries).toHaveLength(1)

    const endpoint = result.queries[0]
    expect(endpoint.responseSchema).toBeDefined()
    expect(endpoint.responseSchema!.source).toBe("introspection")
    expect(endpoint.responseSchema!.discoveredAt).toBeDefined()
    expect(endpoint.responseSchema!.fields).toHaveLength(3)
    expect(endpoint.responseSchema!.fields[0]).toMatchObject({ name: "id", type: "string" })
    expect(endpoint.responseSchema!.fields[2]).toMatchObject({ name: "score", type: "number" })
  })
})
