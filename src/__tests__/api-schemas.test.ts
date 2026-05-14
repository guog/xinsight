import { describe, it, expect } from "vitest"
import {
  CreateDatasourceSchema,
  UpdateDatasourceSchema,
  CreateChatSchema,
  UpdateChatSchema,
} from "@/lib/api-schemas"

describe("API Schema 校验", () => {
  describe("CreateDatasourceSchema", () => {
    it("合法数据通过", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "测试数据源",
        type: "rest",
        auth: JSON.stringify({ apiKey: "xxx" }),
        config: JSON.stringify({ baseUrl: "https://example.com" }),
      })
      expect(result.success).toBe(true)
    })

    it("缺少 name 拒绝", () => {
      const result = CreateDatasourceSchema.safeParse({
        type: "rest",
        auth: "{}",
        config: "{}",
      })
      expect(result.success).toBe(false)
    })

    it("空 name 拒绝", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "",
        type: "rest",
        auth: "{}",
        config: "{}",
      })
      expect(result.success).toBe(false)
    })

    it("额外字段被剔除", () => {
      const result = CreateDatasourceSchema.safeParse({
        name: "test",
        type: "rest",
        auth: "{}",
        config: "{}",
        malicious: "DROP TABLE",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect("malicious" in result.data).toBe(false)
      }
    })
  })

  describe("CreateChatSchema", () => {
    it("空对象通过（所有字段可选）", () => {
      const result = CreateChatSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it("title 超长拒绝", () => {
      const result = CreateChatSchema.safeParse({ title: "a".repeat(501) })
      expect(result.success).toBe(false)
    })

    it("额外字段被剔除", () => {
      const result = CreateChatSchema.safeParse({ title: "test", userId: "injected" })
      expect(result.success).toBe(true)
      if (result.success) {
        expect("userId" in result.data).toBe(false)
      }
    })
  })

  describe("UpdateChatSchema", () => {
    it("部分更新通过", () => {
      const result = UpdateChatSchema.safeParse({ title: "新标题" })
      expect(result.success).toBe(true)
    })
  })
})
