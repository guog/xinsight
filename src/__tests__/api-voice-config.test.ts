import { describe, it, expect, beforeEach, vi } from "vitest"
import { _resetVoiceCache } from "@/lib/voice"

describe("GET /api/voice/config", () => {
  beforeEach(() => {
    _resetVoiceCache()
    vi.unstubAllEnvs()
  })

  it("VOICE_ENABLED 未设置时返回 disabled", async () => {
    vi.stubEnv("VOICE_ENABLED", "")
    vi.stubEnv("DASHSCOPE_API_KEY", "")
    _resetVoiceCache()

    const { GET } = await import("@/app/api/voice/config/route")
    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ enabled: false, stt: null, tts: null })
  })

  it("启用时返回正确配置且不含 apiKey", async () => {
    vi.stubEnv("VOICE_ENABLED", "true")
    vi.stubEnv("DASHSCOPE_API_KEY", "sk-secret-key")
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
    expect(JSON.stringify(data)).not.toContain("sk-secret-key")
  })
})
