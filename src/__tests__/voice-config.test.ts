import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getVoiceConfig, _resetVoiceCache, DEFAULT_VOICE_OPTIONS } from "@/lib/voice"

describe("getVoiceConfig", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    _resetVoiceCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    _resetVoiceCache()
  })

  it("VOICE_ENABLED=false 时返回 disabled", () => {
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.VOICE_ENABLED
    const config = getVoiceConfig()
    expect(config.enabled).toBe(false)
    expect(config.sttProvider).toBeNull()
    expect(config.ttsProvider).toBeNull()
    expect(config.voiceOptions).toEqual(DEFAULT_VOICE_OPTIONS)
  })

  it("无 DASHSCOPE_API_KEY 时返回 disabled", () => {
    process.env.VOICE_ENABLED = "true"
    delete process.env.DASHSCOPE_API_KEY
    const config = getVoiceConfig()
    expect(config.enabled).toBe(false)
  })

  it("正确配置时返回 enabled", () => {
    process.env.VOICE_ENABLED = "true"
    process.env.DASHSCOPE_API_KEY = "test-key"
    const config = getVoiceConfig()
    expect(config.enabled).toBe(true)
    expect(config.sttProvider).not.toBeNull()
    expect(config.sttProvider!.apiKey).toBe("test-key")
    expect(config.ttsProvider).not.toBeNull()
    expect(config.ttsProvider!.voice).toBe("longxiaochun")
  })

  it("TTS_VOICE 环境变量覆盖默认音色", () => {
    process.env.VOICE_ENABLED = "true"
    process.env.DASHSCOPE_API_KEY = "test-key"
    process.env.TTS_VOICE = "longshu"
    const config = getVoiceConfig()
    expect(config.ttsProvider!.voice).toBe("longshu")
  })

  it("结果被缓存", () => {
    process.env.VOICE_ENABLED = "true"
    process.env.DASHSCOPE_API_KEY = "key1"
    const config1 = getVoiceConfig()
    process.env.DASHSCOPE_API_KEY = "key2"
    const config2 = getVoiceConfig()
    expect(config1).toBe(config2) // 同一引用
    expect(config2.sttProvider!.apiKey).toBe("key1")
  })

  it("_resetVoiceCache 清除缓存", () => {
    process.env.VOICE_ENABLED = "true"
    process.env.DASHSCOPE_API_KEY = "key1"
    getVoiceConfig()
    _resetVoiceCache()
    process.env.DASHSCOPE_API_KEY = "key2"
    const config = getVoiceConfig()
    expect(config.sttProvider!.apiKey).toBe("key2")
  })
})

describe("DEFAULT_VOICE_OPTIONS", () => {
  it("包含至少 5 个选项", () => {
    expect(DEFAULT_VOICE_OPTIONS.length).toBeGreaterThanOrEqual(5)
  })

  it("每个选项有 id、name、gender", () => {
    for (const opt of DEFAULT_VOICE_OPTIONS) {
      expect(opt.id).toBeTruthy()
      expect(opt.name).toBeTruthy()
      expect(["男", "女"]).toContain(opt.gender)
    }
  })
})
