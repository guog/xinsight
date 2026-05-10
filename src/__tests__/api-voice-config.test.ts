import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { _resetVoiceCache } from "@/lib/voice"

describe("GET /api/voice/config", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    _resetVoiceCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    _resetVoiceCache()
  })

  it("VOICE_ENABLED 未设置时返回 disabled", async () => {
    process.env.VOICE_ENABLED = ""
    process.env.DASHSCOPE_API_KEY = ""
    _resetVoiceCache()

    const { GET } = await import("@/app/api/voice/config/route")
    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ enabled: false, stt: null, tts: null })
  })

  it("启用时返回正确配置且不含 apiKey", async () => {
    process.env.VOICE_ENABLED = "true"
    process.env.DASHSCOPE_API_KEY = "***"
    _resetVoiceCache()

    const { GET } = await import("@/app/api/voice/config/route")
    const response = await GET()
    const data = await response.json()

    expect(data.enabled).toBe(true)
    expect(data.stt).toMatchObject({
      provider: "dashscope",
      name: "阿里云 DashScope",
      model: "paraformer-realtime-v2",
      languages: ["zh", "en", "ja", "ko"],
    })
    expect(data.tts).toMatchObject({
      provider: "dashscope",
      name: "阿里云 DashScope",
      model: "cosyvoice-v1",
      voice: "longxiaochun",
      sampleRate: 22050,
    })
    expect(data.tts.voices).toBeDefined()
    expect(JSON.stringify(data)).not.toContain("***")
  })
})
