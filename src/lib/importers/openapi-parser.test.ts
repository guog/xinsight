import { describe, it, expect } from "vitest"
import { parseOpenApiSpec, openApiSchemaToFields } from "./openapi-parser"

const specWithResponseSchema = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/users": {
      get: {
        operationId: "listUsers",
        summary: "列出用户",
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "integer", description: "用户 ID" },
                    name: { type: "string", description: "用户名" },
                    active: { type: "boolean" },
                    tags: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          value: { type: "string" },
                        },
                      },
                    },
                    address: {
                      type: "object",
                      properties: {
                        city: { type: "string" },
                        zip: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        operationId: "healthCheck",
        responses: {
          "200": {
            description: "OK",
          },
        },
      },
    },
  },
}

describe("openApiSchemaToFields", () => {
  it("转换 object schema 为 FieldDefinition 数组", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "integer", description: "ID" },
        name: { type: "string" },
      },
    }
    const fields = openApiSchemaToFields(schema)
    expect(fields).toHaveLength(2)
    expect(fields[0]).toEqual({ name: "id", type: "number", description: "ID" })
    expect(fields[1]).toEqual({ name: "name", type: "string" })
  })

  it("处理嵌套 object 和 array", () => {
    const schema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "number" },
            },
          },
        },
      },
    }
    const fields = openApiSchemaToFields(schema)
    expect(fields[0].type).toBe("array")
    expect(fields[0].children).toHaveLength(1)
    expect(fields[0].children![0].name).toBe("x")
  })

  it("忽略 $ref", () => {
    const fields = openApiSchemaToFields({ $ref: "#/components/schemas/Foo" })
    expect(fields).toEqual([])
  })

  it("空 schema 返回空数组", () => {
    expect(openApiSchemaToFields(null)).toEqual([])
    expect(openApiSchemaToFields(undefined)).toEqual([])
  })
})

describe("parseOpenApiSpec responseSchema", () => {
  it("从 200 响应提取 responseSchema", async () => {
    const result = await parseOpenApiSpec(specWithResponseSchema)
    const endpoint = result.endpoints.find((e) => e.id === "listUsers")!
    expect(endpoint.responseSchema).toBeDefined()
    expect(endpoint.responseSchema!.source).toBe("openapi")
    expect(endpoint.responseSchema!.discoveredAt).toBeTruthy()

    const fields = endpoint.responseSchema!.fields
    expect(fields).toHaveLength(5)

    const idField = fields.find((f) => f.name === "id")!
    expect(idField.type).toBe("number")
    expect(idField.description).toBe("用户 ID")

    const tagsField = fields.find((f) => f.name === "tags")!
    expect(tagsField.type).toBe("array")
    expect(tagsField.children).toHaveLength(2)

    const addressField = fields.find((f) => f.name === "address")!
    expect(addressField.type).toBe("object")
    expect(addressField.children).toHaveLength(2)
  })

  it("无 response schema 时 responseSchema 为 undefined", async () => {
    const result = await parseOpenApiSpec(specWithResponseSchema)
    const endpoint = result.endpoints.find((e) => e.id === "healthCheck")!
    expect(endpoint.responseSchema).toBeUndefined()
  })
})
