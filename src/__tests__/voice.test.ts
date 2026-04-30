import { describe, test, expect, beforeEach } from "vitest"
import { getVoiceConfig, _resetVoiceCache } from "@/lib/voice"

describe("语音供应商注册表", () => {
  beforeEach(() => {
    _resetVoiceCache()
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.VOICE_ENABLED
    delete process.env.TTS_VOICE
  })

  test("未配置 API Key 时返回 disabled", () => {
    const config = getVoiceConfig()
    expect(config.enabled).toBe(false)
    expect(config.sttProvider).toBeNull()
    expect(config.ttsProvider).toBeNull()
  })

  test("配置 DASHSCOPE_API_KEY + VOICE_ENABLED=true 时返回正确的 provider 信息", () => {
    process.env.DASHSCOPE_API_KEY = "sk-test-key"
    process.env.VOICE_ENABLED = "true"
    _resetVoiceCache()

    const config = getVoiceConfig()
    expect(config.enabled).toBe(true)
    expect(config.sttProvider).not.toBeNull()
    expect(config.sttProvider!.model).toBe("paraformer-realtime-v2")
    expect(config.sttProvider!.baseUrl).toBe("wss://dashscope.aliyuncs.com/api-ws/v1/inference")
    expect(config.sttProvider!.languages).toEqual(["zh", "en", "ja", "ko"])
    expect(config.ttsProvider).not.toBeNull()
    expect(config.ttsProvider!.model).toBe("cosyvoice-v1")
    expect(config.ttsProvider!.voice).toBe("longxiaochun")
    expect(config.ttsProvider!.sampleRate).toBe(22050)
  })

  test("配置 TTS_VOICE 环境变量时可自定义音色", () => {
    process.env.DASHSCOPE_API_KEY = "sk-test-key"
    process.env.VOICE_ENABLED = "true"
    process.env.TTS_VOICE = "longlaotie"
    _resetVoiceCache()

    const config = getVoiceConfig()
    expect(config.ttsProvider!.voice).toBe("longlaotie")
  })
})
