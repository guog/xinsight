import { describe, test, expect } from "bun:test"
import { FieldDefinitionSchema, ResponseSchemaDefinition, RestEndpointSchema } from "./types"

describe("FieldDefinitionSchema", () => {
  test("parses flat field", () => {
    const result = FieldDefinitionSchema.parse({
      name: "id",
      type: "string",
    })
    expect(result.name).toBe("id")
  })

  test("parses nested children", () => {
    const result = FieldDefinitionSchema.parse({
      name: "user",
      type: "object",
      description: "A user object",
      children: [
        { name: "name", type: "string" },
        {
          name: "address",
          type: "object",
          children: [{ name: "city", type: "string" }],
        },
      ],
    })
    expect(result.children).toHaveLength(2)
    expect(result.children![1].children![0].name).toBe("city")
  })
})

describe("ResponseSchemaDefinition", () => {
  test("parses valid data", () => {
    const result = ResponseSchemaDefinition.parse({
      fields: [{ name: "status", type: "number" }],
      description: "API response",
      discoveredAt: "2024-01-01T00:00:00Z",
      source: "openapi",
    })
    expect(result.fields).toHaveLength(1)
    expect(result.source).toBe("openapi")
  })

  test("parses minimal data", () => {
    const result = ResponseSchemaDefinition.parse({
      fields: [],
    })
    expect(result.fields).toHaveLength(0)
  })
})

describe("RestEndpointSchema", () => {
  test("accepts responseSchema field", () => {
    const result = RestEndpointSchema.parse({
      id: "get-users",
      name: "Get Users",
      method: "GET",
      path: "/users",
      responseSchema: {
        fields: [{ name: "users", type: "array", children: [{ name: "id", type: "string" }] }],
        source: "inferred",
      },
    })
    expect(result.responseSchema).toBeDefined()
    expect(result.responseSchema!.fields[0].name).toBe("users")
  })

  test("works without responseSchema", () => {
    const result = RestEndpointSchema.parse({
      id: "get-users",
      name: "Get Users",
      method: "GET",
      path: "/users",
    })
    expect(result.responseSchema).toBeUndefined()
  })
})
