import { describe, it, expect } from "vitest"
import {
  CreateDatasourceSchema,
  UpdateDatasourceSchema,
  CreateChatSchema,
  UpdateChatSchema,
  CreateMessageSchema,
  CreateProviderSchema,
} from "@/lib/api-schemas"

describe("api-schemas 验证", () => {
  describe("CreateDatasourceSchema", () => {
    it("有效输入通过验证", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "测试数据源",
        type: "rest",
        auth: "{}",
        config: "{}",
      })
      expect(result.success).toBe(true)
    })

    it("name 为空时失败", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "",
        type: "rest",
        auth: "{}",
        config: "{}",
      })
      expect(result.success).toBe(false)
    })

    it("name 超长时失败", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "a".repeat(201),
        type: "rest",
        auth: "{}",
        config: "{}",
      })
      expect(result.success).toBe(false)
    })

    it("auth 可以是对象", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "test",
        type: "rest",
        auth: { token: "abc" },
        config: {},
      })
      expect(result.success).toBe(true)
    })

    it("endpoints 可选", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "test",
        type: "rest",
        auth: "{}",
        config: "{}",
        endpoints: [{ id: "ep1" }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe("UpdateDatasourceSchema", () => {
    it("所有字段可选", () => {
      const result = UpdateDatasourceSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it("部分更新有效", () => {
      const result = UpdateDatasourceSchema.safeParse({ name: "新名称", enabled: false })
      expect(result.success).toBe(true)
    })
  })

  describe("CreateChatSchema", () => {
    it("空对象有效（所有字段可选）", () => {
      expect(CreateChatSchema.safeParse({}).success).toBe(true)
    })

    it("title 超长失败", () => {
      expect(CreateChatSchema.safeParse({ title: "a".repeat(501) }).success).toBe(false)
    })

    it("modelId 可以为 null", () => {
      expect(CreateChatSchema.safeParse({ modelId: null }).success).toBe(true)
    })
  })

  describe("UpdateChatSchema", () => {
    it("部分更新有效", () => {
      expect(UpdateChatSchema.safeParse({ title: "新标题" }).success).toBe(true)
    })
  })

  describe("CreateMessageSchema", () => {
    it("user 消息有效", () => {
      expect(CreateMessageSchema.safeParse({ role: "user", parts: "hello" }).success).toBe(true)
    })

    it("assistant 消息有效", () => {
      expect(
        CreateMessageSchema.safeParse({ role: "assistant", parts: [{ type: "text", text: "hi" }] })
          .success,
      ).toBe(true)
    })

    it("无效 role 失败", () => {
      expect(CreateMessageSchema.safeParse({ role: "system", parts: "x" }).success).toBe(false)
    })

    it("parts 超过 100KB 失败", () => {
      const bigParts = "x".repeat(102401)
      expect(CreateMessageSchema.safeParse({ role: "user", parts: bigParts }).success).toBe(false)
    })
  })

  describe("CreateProviderSchema", () => {
    it("有效输入通过", () => {
      const result = CreateProviderSchema.safeParse({
        id: "test-provider",
        name: "Test Provider",
        type: "cloud",
        apiFormat: "openai",
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-123",
      })
      expect(result.success).toBe(true)
    })

    it("id 含大写字母失败", () => {
      const result = CreateProviderSchema.safeParse({
        id: "TestProvider",
        name: "Test",
        baseUrl: "https://api.example.com/v1",
      })
      expect(result.success).toBe(false)
    })

    it("无效 URL 失败", () => {
      const result = CreateProviderSchema.safeParse({
        id: "test",
        name: "Test",
        baseUrl: "not-a-url",
      })
      expect(result.success).toBe(false)
    })

    it("id 含特殊字符失败", () => {
      const result = CreateProviderSchema.safeParse({
        id: "test provider!",
        name: "Test",
        baseUrl: "https://api.example.com/v1",
      })
      expect(result.success).toBe(false)
    })
  })
})
