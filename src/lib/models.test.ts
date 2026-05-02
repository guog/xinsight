import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  getProviders,
  getModels,
  getModelById,
  getDefaultModelId,
  getProviderForModel,
  _resetCache,
} from "./models"

const TEST_PROVIDER_ID = "__test_models_ts__"

describe("模型注册表", () => {
  beforeEach(() => {
    _resetCache()
    // 插入测试数据
    const now = new Date()
    db.insert(llmProviders).values({
      id: TEST_PROVIDER_ID,
      name: "TestProvider",
      type: "cloud",
      apiFormat: "openai",
      baseUrl: "https://test.example.com",
      apiKey: "test-key",
      apiKeyRequired: true,
      enabled: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    }).run()

    db.insert(llmModels).values([
      {
        id: `${TEST_PROVIDER_ID}/model-a`,
        providerId: TEST_PROVIDER_ID,
        modelSlug: "model-a",
        name: "Model A",
        enabled: true,
        status: "available",
        capabilities: JSON.stringify({ chat: true }),
        sortOrder: 0,
        discoveredAt: now,
        updatedAt: now,
      },
      {
        id: `${TEST_PROVIDER_ID}/model-b`,
        providerId: TEST_PROVIDER_ID,
        modelSlug: "model-b",
        name: "Model B",
        enabled: false,
        status: "available",
        capabilities: JSON.stringify({ chat: true }),
        sortOrder: 1,
        discoveredAt: now,
        updatedAt: now,
      },
    ]).run()
  })

  afterEach(() => {
    db.delete(llmModels).where(eq(llmModels.providerId, TEST_PROVIDER_ID)).run()
    db.delete(llmProviders).where(eq(llmProviders.id, TEST_PROVIDER_ID)).run()
    _resetCache()
  })

  describe("getProviders", () => {
    it("应该返回预定义的模型提供商列表", () => {
      const providers = getProviders()
      expect(providers.length).toBeGreaterThan(0)
      expect(providers[0]).toHaveProperty("id")
      expect(providers[0]).toHaveProperty("name")
    })

    it("应该包含测试提供商", () => {
      const providers = getProviders()
      const tp = providers.find((p) => p.id === TEST_PROVIDER_ID)
      expect(tp).toBeDefined()
      expect(tp!.name).toBe("TestProvider")
    })

    it("禁用的提供商不出现", () => {
      db.update(llmProviders).set({ enabled: false }).where(eq(llmProviders.id, TEST_PROVIDER_ID)).run()
      _resetCache()
      const providers = getProviders()
      expect(providers.find((p) => p.id === TEST_PROVIDER_ID)).toBeUndefined()
    })
  })

  describe("getModels", () => {
    it("应该返回所有已启用模型", () => {
      const models = getModels()
      const ours = models.filter((m) => m.providerId === TEST_PROVIDER_ID)
      // model-a enabled, model-b disabled
      expect(ours.length).toBe(1)
      expect(ours[0].id).toBe(`${TEST_PROVIDER_ID}/model-a`)
    })

    it("每个模型应该有完整的信息", () => {
      const models = getModels()
      for (const model of models) {
        expect(model.id).toBeTruthy()
        expect(model.name).toBeTruthy()
        expect(model.providerId).toBeTruthy()
      }
    })
  })

  describe("getModelById", () => {
    it("应该通过 ID 找到模型", () => {
      const model = getModelById(`${TEST_PROVIDER_ID}/model-a`)
      expect(model).toBeDefined()
      expect(model!.name).toBe("Model A")
    })

    it("找不到时应该返回 undefined", () => {
      const model = getModelById("nonexistent/model")
      expect(model).toBeUndefined()
    })
  })

  describe("getDefaultModelId", () => {
    it("应该返回第一个模型的 ID", () => {
      const id = getDefaultModelId()
      expect(id).toBeTruthy()
    })
  })

  describe("getProviderForModel", () => {
    it("根据 modelId 找到提供商", () => {
      const p = getProviderForModel(`${TEST_PROVIDER_ID}/model-a`)
      expect(p).toBeDefined()
      expect(p!.id).toBe(TEST_PROVIDER_ID)
    })
  })
})
