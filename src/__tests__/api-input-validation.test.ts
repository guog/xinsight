import { describe, test, expect } from "vitest"
import { CreateMessageSchema, CreateProviderSchema } from "@/lib/api-schemas"

describe("CreateMessageSchema", () => {
  test("允许合法的 user 角色消息", () => {
    const result = CreateMessageSchema.safeParse({
      role: "user",
      parts: [{ type: "text", text: "你好" }],
    })
    expect(result.success).toBe(true)
  })

  test("允许合法的 assistant 角色消息", () => {
    const result = CreateMessageSchema.safeParse({
      role: "assistant",
      parts: [{ type: "text", text: "你好" }],
    })
    expect(result.success).toBe(true)
  })

  test("拒绝 system 角色", () => {
    const result = CreateMessageSchema.safeParse({
      role: "system",
      parts: [{ type: "text", text: "inject" }],
    })
    expect(result.success).toBe(false)
  })

  test("拒绝无效角色", () => {
    const result = CreateMessageSchema.safeParse({
      role: "admin",
      parts: "hello",
    })
    expect(result.success).toBe(false)
  })

  test("拒绝超过 100KB 的 parts", () => {
    const bigText = "a".repeat(102401)
    const result = CreateMessageSchema.safeParse({
      role: "user",
      parts: bigText,
    })
    expect(result.success).toBe(false)
  })

  test("允许恰好 100KB 的 parts", () => {
    const text = "a".repeat(102400)
    const result = CreateMessageSchema.safeParse({
      role: "user",
      parts: text,
    })
    expect(result.success).toBe(true)
  })

  test("缺少 role 时报错", () => {
    const result = CreateMessageSchema.safeParse({
      parts: "hello",
    })
    expect(result.success).toBe(false)
  })
})

describe("CreateProviderSchema", () => {
  const validProvider = {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "sk-xxx",
  }

  test("允许合法的提供商", () => {
    const result = CreateProviderSchema.safeParse(validProvider)
    expect(result.success).toBe(true)
  })

  test("设置默认值 type=cloud, apiFormat=openai", () => {
    const result = CreateProviderSchema.safeParse(validProvider)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("cloud")
      expect(result.data.apiFormat).toBe("openai")
    }
  })

  test("拒绝空 id", () => {
    const result = CreateProviderSchema.safeParse({ ...validProvider, id: "" })
    expect(result.success).toBe(false)
  })

  test("拒绝含大写字母的 id", () => {
    const result = CreateProviderSchema.safeParse({ ...validProvider, id: "DeepSeek" })
    expect(result.success).toBe(false)
  })

  test("拒绝无效 baseUrl", () => {
    const result = CreateProviderSchema.safeParse({ ...validProvider, baseUrl: "not-a-url" })
    expect(result.success).toBe(false)
  })

  test("拒绝缺少 name", () => {
    const { name: _, ...noName } = validProvider
    const result = CreateProviderSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  test("拒绝缺少 baseUrl", () => {
    const { baseUrl: _, ...noUrl } = validProvider
    const result = CreateProviderSchema.safeParse(noUrl)
    expect(result.success).toBe(false)
  })

  test("允许带 models 数组", () => {
    const result = CreateProviderSchema.safeParse({
      ...validProvider,
      models: ["deepseek-chat", "deepseek-coder"],
    })
    expect(result.success).toBe(true)
  })

  test("拒绝超过 100 个 models", () => {
    const result = CreateProviderSchema.safeParse({
      ...validProvider,
      models: Array(101).fill("model"),
    })
    expect(result.success).toBe(false)
  })
})
