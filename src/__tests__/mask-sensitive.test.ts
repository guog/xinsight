import { describe, it, expect } from "vitest"
import { maskSensitiveFields, maskString } from "@/lib/mask-sensitive"

describe("maskSensitiveFields", () => {
  it("脱敏 auth JSON 字符串中的敏感字段", () => {
    const input = {
      id: "ds-1",
      name: "测试数据源",
      auth: JSON.stringify({ apiKey: "sk-1234567890abcdef", host: "example.com" }),
    }
    const result = maskSensitiveFields(input)
    const auth = JSON.parse(result.auth as string)
    expect(auth.apiKey).toBe("sk***ef")
    expect(auth.host).toBe("example.com")
  })

  it("脱敏顶层 apiKey 字段", () => {
    const input = { id: "p-1", apiKey: "sk-abcdefghij1234567890", name: "test" }
    const result = maskSensitiveFields(input)
    expect(result.apiKey).toBe("sk***90")
    expect(result.name).toBe("test")
  })

  it("脱敏顶层 api_key 字段", () => {
    const input = { id: "p-1", api_key: "long-secret-key-value", name: "test" }
    const result = maskSensitiveFields(input)
    expect(result.api_key).toBe("lo***ue")
  })

  it("短值完全脱敏", () => {
    expect(maskString("short")).toBe("***")
    expect(maskString("12345678")).toBe("***")
  })

  it("无敏感字段不影响数据", () => {
    const input = { id: "1", name: "普通数据", type: "rest" }
    const result = maskSensitiveFields(input)
    expect(result).toEqual(input)
  })
})
