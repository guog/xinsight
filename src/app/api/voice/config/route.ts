import { NextResponse } from "next/server"
import { getVoiceConfig } from "@/lib/voice"
import { requireAuth, handleAuthError } from "@/lib/auth"

export async function GET() {
  try {
    await requireAuth()
  } catch (error) {
    return handleAuthError(error) ?? NextResponse.json({ error: "未知错误" }, { status: 500 })
  }

  const config = getVoiceConfig()

  if (!config.enabled) {
    return NextResponse.json({ enabled: false, stt: null, tts: null })
  }

  const { sttProvider, ttsProvider, voiceOptions } = config

  return NextResponse.json({
    enabled: true,
    stt: sttProvider
      ? {
          provider: sttProvider.provider,
          name: "阿里云 DashScope",
          model: sttProvider.model,
          languages: sttProvider.languages,
        }
      : null,
    tts: ttsProvider
      ? {
          provider: ttsProvider.provider,
          name: "阿里云 DashScope",
          model: ttsProvider.model,
          voice: ttsProvider.voice,
          sampleRate: ttsProvider.sampleRate,
          voices: voiceOptions,
        }
      : null,
  })
}
