import { describe, it, expect } from "vitest"
import {
  getProviders,
  getModels,
  getModelById,
  getDefaultModelId,
  type ProviderInfo,
} from "./models"

describe("模型注册表", () => {
  describe("getProviders", () => {
    it("应该返回预定义的模型提供商列表", () => {
      const providers = getProviders()
      expect(providers.length).toBeGreaterThan(0)
      expect(providers[0]).toHaveProperty("id")
      expect(providers[0]).toHaveProperty("name")
    })

    it("应该包含 DeepSeek 提供商", () => {
      const providers = getProviders()
      const deepseek = providers.find((p: ProviderInfo) => p.id === "deepseek")
      expect(deepseek).toBeDefined()
      expect(deepseek!.name).toBe("DeepSeek")
    })
  })

  describe("getModels", () => {
    it("应该返回所有可用模型", () => {
      const models = getModels()
      expect(models.length).toBeGreaterThan(0)
    })

    it("每个模型应该有完整的信息", () => {
      const models = getModels()
      for (const model of models) {
        expect(model.id).toMatch(/^[a-z]+\//)
        expect(model.name).toBeTruthy()
        expect(model.providerId).toBeTruthy()
      }
    })
  })

  describe("getModelById", () => {
    it("应该通过 ID 找到模型", () => {
      const model = getModelById("deepseek/deepseek-chat")
      expect(model).toBeDefined()
      expect(model!.name).toBeTruthy()
    })

    it("找不到时应该返回 undefined", () => {
      const model = getModelById("nonexistent/model")
      expect(model).toBeUndefined()
    })
  })

  describe("getDefaultModelId", () => {
    it("应该返回默认模型 ID", () => {
      const id = getDefaultModelId()
      expect(id).toBe("deepseek/deepseek-chat")
    })
  })
})
