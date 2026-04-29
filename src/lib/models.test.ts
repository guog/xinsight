import { describe, it, expect, beforeEach, afterAll } from "vitest"
import {
  getProviders,
  getModels,
  getModelById,
  getDefaultModelId,
  _resetCache,
  type ProviderInfo,
} from "./models"

// 保存原始环境变量
const origEnv = { ...process.env }

describe("模型注册表", () => {
  beforeEach(() => {
    _resetCache()
    // 设置测试用环境变量
    process.env.LLM_PROVIDERS = "deepseek,qwen"
    process.env.DEEPSEEK_API_KEY = "test-key"
    process.env.DASHSCOPE_API_KEY = "test-key"
  })

  afterAll(() => {
    // 恢复原始环境变量
    Object.keys(process.env).forEach((k) => {
      if (!(k in origEnv)) delete process.env[k]
      else process.env[k] = origEnv[k]
    })
    _resetCache()
  })

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

    it("没有 API Key 时不应返回该提供商", () => {
      _resetCache()
      delete process.env.DASHSCOPE_API_KEY
      const providers = getProviders()
      expect(providers.find((p) => p.id === "qwen")).toBeUndefined()
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
