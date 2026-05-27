import { describe, it, expect } from "vitest"
import {
  validateParams,
  formatParamHints,
  safeFilterParams,
  SENSITIVE_KEYS,
  whitelistFilterParams,
  isWriteEndpoint,
} from "@/mastra/tools/datasource/validate-params"
import type { StructuredParam } from "@/mastra/tools/datasource/types"

describe("validateParams", () => {
  it("无参数定义时始终有效", () => {
    expect(validateParams([], { foo: "bar" })).toEqual({ valid: true, errors: [] })
  })

  it("必填参数缺失时报错", () => {
    const params: StructuredParam[] = [{ name: "id", type: "string", required: true }]
    const result = validateParams(params, {})
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("id")
    expect(result.errors[0]).toContain("必填")
  })

  it("必填参数为空字符串时报错", () => {
    const params: StructuredParam[] = [{ name: "id", type: "string", required: true }]
    expect(validateParams(params, { id: "" }).valid).toBe(false)
  })

  it("可选参数缺失时通过", () => {
    const params: StructuredParam[] = [{ name: "name", type: "string", required: false }]
    expect(validateParams(params, {}).valid).toBe(true)
  })

  it("number 类型校验", () => {
    const params: StructuredParam[] = [{ name: "count", type: "number", required: false }]
    expect(validateParams(params, { count: 123 }).valid).toBe(true)
    expect(validateParams(params, { count: "456" }).valid).toBe(true)
    expect(validateParams(params, { count: "abc" }).valid).toBe(false)
  })

  it("boolean 类型校验", () => {
    const params: StructuredParam[] = [{ name: "flag", type: "boolean", required: false }]
    expect(validateParams(params, { flag: true }).valid).toBe(true)
    expect(validateParams(params, { flag: "true" }).valid).toBe(true)
    expect(validateParams(params, { flag: "false" }).valid).toBe(true)
    expect(validateParams(params, { flag: "yes" }).valid).toBe(false)
  })

  it("date 类型校验", () => {
    const params: StructuredParam[] = [{ name: "start", type: "date", required: false }]
    expect(validateParams(params, { start: "2024-01-01" }).valid).toBe(true)
    expect(validateParams(params, { start: "2024/01/01" }).valid).toBe(true)
    expect(validateParams(params, { start: "not-a-date" }).valid).toBe(false)
  })

  it("date 格式错误包含 format 提示", () => {
    const params: StructuredParam[] = [
      { name: "dt", type: "date", required: false, format: "yyyy-MM-dd HH:mm" },
    ]
    const result = validateParams(params, { dt: "invalid" })
    expect(result.errors[0]).toContain("yyyy-MM-dd HH:mm")
  })

  it("enum 类型校验", () => {
    const params: StructuredParam[] = [
      { name: "status", type: "enum", required: false, enum: ["active", "inactive"] },
    ]
    expect(validateParams(params, { status: "active" }).valid).toBe(true)
    expect(validateParams(params, { status: "unknown" }).valid).toBe(false)
  })

  it("enum 无选项定义时跳过", () => {
    const params: StructuredParam[] = [{ name: "x", type: "enum", required: false }]
    expect(validateParams(params, { x: "anything" }).valid).toBe(true)
  })

  it("多个错误累积", () => {
    const params: StructuredParam[] = [
      { name: "a", type: "number", required: true },
      { name: "b", type: "boolean", required: true },
    ]
    const result = validateParams(params, {})
    expect(result.errors.length).toBe(2)
  })
})

describe("formatParamHints", () => {
  it("生成参数提示", () => {
    const params: StructuredParam[] = [
      { name: "id", type: "string", required: true, description: "设备ID" },
      {
        name: "type",
        type: "enum",
        required: false,
        enum: ["A", "B"],
        example: "A",
        default: "A",
      },
    ]
    const hints = formatParamHints(params)
    expect(hints).toContain("id (string, 必填)")
    expect(hints).toContain("设备ID")
    expect(hints).toContain("type (enum, 可选)")
    expect(hints).toContain("[可选值: A, B]")
    expect(hints).toContain('[示例: "A"]')
    expect(hints).toContain('[默认: "A"]')
  })

  it("format 字段显示", () => {
    const params: StructuredParam[] = [
      { name: "date", type: "date", required: false, format: "yyyy-MM-dd" },
    ]
    const hints = formatParamHints(params)
    expect(hints).toContain("[格式: yyyy-MM-dd]")
  })
})

describe("safeFilterParams and SENSITIVE_KEYS", () => {
  it("应该过滤敏感键（如 method, headers 等），但保留普通业务参数（如 id, name, type）", () => {
    const input = {
      name: "Alice",
      id: "123",
      type: "sensor",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      url: "https://evil.com",
    }
    const result = safeFilterParams(input)
    expect(result.name).toBe("Alice")
    expect(result.id).toBe("123")
    expect(result.type).toBe("sensor")
    expect(result.method).toBeUndefined()
    expect(result.headers).toBeUndefined()
    expect(result.url).toBeUndefined()
  })

  it("安全黑名单中必须覆盖已知协议的所有敏感配置词", () => {
    const requiredKeys = ["method", "path", "headers", "url", "query", "variables", "auth"]
    for (const key of requiredKeys) {
      expect(SENSITIVE_KEYS).toContain(key)
    }
  })
})

describe("whitelistFilterParams", () => {
  it("应该只保留在 structuredParams 中声明的字段，并允许 endpointId", () => {
    const params: StructuredParam[] = [
      { name: "id", type: "string", required: true },
      { name: "limit", type: "number", required: false },
    ]
    const input = {
      id: "sensor-1",
      limit: 10,
      endpointId: "ep-1",
      evilParam: "drop-me",
      path: "/something",
    }
    const result = whitelistFilterParams(input, params)
    expect(result.id).toBe("sensor-1")
    expect(result.limit).toBe(10)
    expect(result.endpointId).toBe("ep-1")
    expect(result.evilParam).toBeUndefined()
    expect(result.path).toBeUndefined()
  })

  it("未声明 structuredParams 时应原样返回", () => {
    const input = { id: "1" }
    expect(whitelistFilterParams(input, [])).toEqual(input)
    expect(whitelistFilterParams(input, null)).toEqual(input)
  })
})

describe("isWriteEndpoint with readonly support", () => {
  it("显式标明 readonly 的端点应豁免为写操作", () => {
    const ep = {
      id: "write-op",
      method: "POST",
      readonly: true,
    }
    expect(isWriteEndpoint(ep)).toBe(false)
  })

  it("未标明 readonly 且 method 为 POST 的端点应被视为写操作", () => {
    const ep = {
      id: "write-op",
      method: "POST",
    }
    expect(isWriteEndpoint(ep)).toBe(true)
  })
})
