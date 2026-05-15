import { describe, it, expect } from "vitest"
import { validateParams, formatParamHints } from "@/mastra/tools/datasource/validate-params"
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
