import { describe, it, expect } from "vitest"
import { DatasourceEndpointSchema, ApiSchemaFormat } from "@/mastra/tools/datasource/types"

describe("ApiSchemaFormat", () => {
  it("默认值为 natural", () => {
    const result = ApiSchemaFormat.parse(undefined)
    expect(result).toBe("natural")
  })

  it("接受 natural 和 openapi", () => {
    expect(ApiSchemaFormat.parse("natural")).toBe("natural")
    expect(ApiSchemaFormat.parse("openapi")).toBe("openapi")
  })

  it("拒绝无效值", () => {
    expect(() => ApiSchemaFormat.parse("invalid")).toThrow()
  })
})

describe("DatasourceEndpointSchema — apiSchemaFormat 字段", () => {
  const baseEndpoint = {
    id: "ep-1",
    name: "获取订单",
    description: "查询订单列表",
    params: { method: "GET", path: "/orders" },
  }

  it("不传 apiSchemaFormat 时默认为 natural", () => {
    const result = DatasourceEndpointSchema.parse(baseEndpoint)
    expect(result.apiSchemaFormat).toBe("natural")
  })

  it("支持 natural 格式 — 自然语言描述", () => {
    const result = DatasourceEndpointSchema.parse({
      ...baseEndpoint,
      apiSchemaFormat: "natural",
      paramSchema: "需要传入 orderId (字符串) 和 status (可选，枚举：pending/completed)",
    })
    expect(result.apiSchemaFormat).toBe("natural")
    expect(result.paramSchema).toContain("orderId")
  })

  it("支持 openapi 格式 — 结构化 JSON Schema", () => {
    const openApiSchema = JSON.stringify({
      type: "object",
      properties: {
        orderId: { type: "string", description: "订单 ID" },
        status: { type: "string", enum: ["pending", "completed"] },
      },
      required: ["orderId"],
    })
    const result = DatasourceEndpointSchema.parse({
      ...baseEndpoint,
      apiSchemaFormat: "openapi",
      paramSchema: openApiSchema,
    })
    expect(result.apiSchemaFormat).toBe("openapi")
    expect(JSON.parse(result.paramSchema!).properties.orderId.type).toBe("string")
  })
})
