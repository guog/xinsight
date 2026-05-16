import { describe, it, expect } from "vitest"
import { parseOpenApiSpec, openApiSchemaToFields } from "../openapi-parser"

// 简单的 OpenAPI 3.0 规范，包含 2 个端点
const simpleSpec = {
  openapi: "3.0.0",
  info: { title: "测试 API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com/v1" }],
  paths: {
    "/users": {
      get: {
        operationId: "listUsers",
        summary: "获取用户列表",
        description: "返回所有用户",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "X-Request-Id", in: "header", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
      },
      post: {
        operationId: "createUser",
        summary: "创建用户",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "已创建" } },
      },
    },
  },
}

describe("parseOpenApiSpec", () => {
  it("解析简单 OpenAPI 3.0 JSON 对象，包含 2 个端点", async () => {
    const result = await parseOpenApiSpec(simpleSpec as Record<string, unknown>)
    expect(result.endpoints).toHaveLength(2)
    expect(result.info.title).toBe("测试 API")
    expect(result.info.version).toBe("1.0.0")
  })

  it("从 servers 提取 baseUrl", async () => {
    const result = await parseOpenApiSpec(simpleSpec as Record<string, unknown>)
    expect(result.baseUrl).toBe("https://api.example.com/v1")
  })

  it("处理 YAML 字符串输入", async () => {
    const yaml = `
openapi: "3.0.0"
info:
  title: YAML API
  version: "2.0"
servers:
  - url: https://yaml.example.com
paths:
  /items:
    get:
      summary: 获取项目
      responses:
        "200":
          description: OK
`
    const result = await parseOpenApiSpec(yaml)
    expect(result.info.title).toBe("YAML API")
    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints[0].method).toBe("GET")
    expect(result.endpoints[0].path).toBe("/items")
  })

  it("缺少 operationId 时从 method+path 生成 id", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "No OpId", version: "1.0" },
      paths: {
        "/orders/{id}": {
          delete: {
            summary: "删除订单",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    expect(result.endpoints[0].id).toBe("delete--orders-{id}")
    expect(result.endpoints[0].name).toBe("删除订单")
  })

  it("提取 requestBody", async () => {
    const result = await parseOpenApiSpec(simpleSpec as Record<string, unknown>)
    const post = result.endpoints.find((e) => e.method === "POST")!
    expect(post.requestBody).toBeDefined()
    const body = JSON.parse(post.requestBody!)
    expect(body.type).toBe("object")
    expect(body.properties.name.type).toBe("string")
  })

  it("提取 query 参数", async () => {
    const result = await parseOpenApiSpec(simpleSpec as Record<string, unknown>)
    const get = result.endpoints.find((e) => e.method === "GET")!
    expect(get.queryParams).toEqual({ page: "integer", limit: "integer" })
  })

  it("无效输入时抛出有意义的错误", async () => {
    await expect(parseOpenApiSpec("not valid json or yaml{{{")).rejects.toThrow(/无法解析/)
    await expect(parseOpenApiSpec({ random: "object" } as Record<string, unknown>)).rejects.toThrow(
      /不是有效的 OpenAPI/,
    )
  })

  it("readOnly 模式仅返回 GET 端点", async () => {
    const result = await parseOpenApiSpec(simpleSpec as Record<string, unknown>, {
      readOnly: true,
    })
    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints[0].method).toBe("GET")
  })

  it("methods 选项过滤指定方法", async () => {
    const result = await parseOpenApiSpec(simpleSpec as Record<string, unknown>, {
      methods: ["post"],
    })
    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints[0].method).toBe("POST")
  })

  it("解析 $ref 引用的 requestBody schema", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Ref API", version: "1.0" },
      paths: {
        "/items": {
          post: {
            operationId: "createItem",
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Item" },
                },
              },
            },
            responses: { "201": { description: "已创建" } },
          },
        },
      },
      components: {
        schemas: {
          Item: {
            type: "object",
            properties: {
              name: { type: "string" },
              price: { type: "number" },
            },
          },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    const ep = result.endpoints[0]
    expect(ep.requestBody).toBeDefined()
    const body = JSON.parse(ep.requestBody!)
    expect(body.type).toBe("object")
    expect(body.properties.name.type).toBe("string")
  })

  it("解析 $ref 引用的 response schema", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Ref API", version: "1.0" },
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            responses: {
              "200": {
                description: "成功",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Item" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Item: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
            },
          },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    const ep = result.endpoints[0]
    expect(ep.responseExample).toBeDefined()
    const schema = JSON.parse(ep.responseExample!)
    expect(schema.type).toBe("array")
    expect(schema.items.properties.id.type).toBe("integer")
  })

  it("合并 path 级别和 operation 级别 parameters", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Merge API", version: "1.0" },
      paths: {
        "/items/{id}": {
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "version", in: "query", schema: { type: "string" } },
          ],
          get: {
            operationId: "getItem",
            parameters: [
              { name: "version", in: "query", schema: { type: "integer" } }, // 覆盖 path 级别
              { name: "fields", in: "query", schema: { type: "string" } },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    const ep = result.endpoints[0]
    // version 应被 operation 级别覆盖为 integer
    expect(ep.queryParams?.version).toBe("integer")
    expect(ep.queryParams?.fields).toBe("string")
    // structuredParams 从 operation 级别提取（version 覆盖 + fields）
    expect(ep.structuredParams!.length).toBeGreaterThanOrEqual(2)
  })

  it("提取 structuredParams 含 enum 和 default", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Param API", version: "1.0" },
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            parameters: [
              {
                name: "sort",
                in: "query",
                schema: {
                  type: "string",
                  enum: ["asc", "desc"],
                  default: "asc",
                },
              },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    const sp = result.endpoints[0].structuredParams!
    expect(sp).toHaveLength(1)
    expect(sp[0].name).toBe("sort")
    expect(sp[0].enum).toEqual(["asc", "desc"])
    expect(sp[0].default).toBe("asc")
  })

  it("检测 securitySchemes 中的 bearer 认证", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Auth API", version: "1.0" },
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    expect(result.authType).toBe("bearer")
  })

  it("检测 securitySchemes 中的 apikey 认证", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Key API", version: "1.0" },
      paths: {},
      components: {
        securitySchemes: {
          apiKey: { type: "apiKey", name: "X-API-Key", in: "header" },
        },
      },
    }
    const result = await parseOpenApiSpec(spec as Record<string, unknown>)
    expect(result.authType).toBe("apikey")
  })
})

describe("openApiSchemaToFields", () => {
  it("将 object schema 转换为 FieldDefinition 数组", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "integer", description: "用户 ID" },
        name: { type: "string" },
        active: { type: "boolean" },
      },
    }
    const fields = openApiSchemaToFields(schema)
    expect(fields).toHaveLength(3)
    expect(fields[0]).toEqual({ name: "id", type: "number", description: "用户 ID" })
    expect(fields[1]).toEqual({ name: "name", type: "string" })
    expect(fields[2]).toEqual({ name: "active", type: "boolean" })
  })

  it("处理嵌套 object", () => {
    const schema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
        },
      },
    }
    const fields = openApiSchemaToFields(schema)
    expect(fields[0].children).toHaveLength(1)
    expect(fields[0].children![0].name).toBe("city")
  })

  it("处理 array schema（展开 items）", () => {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    }
    const fields = openApiSchemaToFields(schema)
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe("name")
  })

  it("空或无效输入返回空数组", () => {
    expect(openApiSchemaToFields(null)).toEqual([])
    expect(openApiSchemaToFields(undefined)).toEqual([])
    expect(openApiSchemaToFields({ $ref: "#/foo" })).toEqual([])
  })
})
