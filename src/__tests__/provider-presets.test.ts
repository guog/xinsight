import { describe, it, expect } from "vitest"
import { PROVIDER_PRESETS, getPresets, getPresetsByType } from "@/lib/provider/presets"

describe("provider presets", () => {
  describe("PROVIDER_PRESETS", () => {
    it("包含所有预期的 provider", () => {
      expect(Object.keys(PROVIDER_PRESETS)).toContain("deepseek")
      expect(Object.keys(PROVIDER_PRESETS)).toContain("qwen")
      expect(Object.keys(PROVIDER_PRESETS)).toContain("openai")
      expect(Object.keys(PROVIDER_PRESETS)).toContain("anthropic")
      expect(Object.keys(PROVIDER_PRESETS)).toContain("ollama")
    })

    it("云端 provider 要求 apiKey", () => {
      expect(PROVIDER_PRESETS.deepseek.apiKeyRequired).toBe(true)
      expect(PROVIDER_PRESETS.openai.apiKeyRequired).toBe(true)
      expect(PROVIDER_PRESETS.anthropic.apiKeyRequired).toBe(true)
    })

    it("本地 provider 不要求 apiKey", () => {
      expect(PROVIDER_PRESETS.ollama.apiKeyRequired).toBe(false)
      expect(PROVIDER_PRESETS.litellm.apiKeyRequired).toBe(false)
      expect(PROVIDER_PRESETS.vllm.apiKeyRequired).toBe(false)
    })

    it("每个 preset 都有合法的 id 和 name", () => {
      for (const preset of Object.values(PROVIDER_PRESETS)) {
        expect(preset.id).toBeTruthy()
        expect(preset.name).toBeTruthy()
        expect(preset.defaultBaseUrl).toMatch(/^https?:\/\//)
        expect(["openai", "ollama"]).toContain(preset.apiFormat)
      }
    })
  })

  describe("getPresets", () => {
    it("返回所有预设的数组", () => {
      const presets = getPresets()
      expect(presets.length).toBe(Object.keys(PROVIDER_PRESETS).length)
    })
  })

  describe("getPresetsByType", () => {
    it("正确按类型分组", () => {
      const { cloud, local } = getPresetsByType()
      expect(cloud.length).toBeGreaterThan(0)
      expect(local.length).toBeGreaterThan(0)
      expect(cloud.every((p) => p.type === "cloud")).toBe(true)
      expect(local.every((p) => p.type === "local")).toBe(true)
    })

    it("cloud + local 总数等于全部预设", () => {
      const { cloud, local } = getPresetsByType()
      expect(cloud.length + local.length).toBe(getPresets().length)
    })
  })
})
