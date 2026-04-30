// 语音供应商注册表

export interface STTProviderInfo {
  provider: string
  model: string
  baseUrl: string
  languages: string[]
  apiKey: string
}

export interface TTSProviderInfo {
  provider: string
  model: string
  baseUrl: string
  voice: string
  sampleRate: number
  apiKey: string
}

export interface VoiceOption {
  id: string
  name: string
  gender: string
  language?: string
}

export interface VoiceConfig {
  enabled: boolean
  sttProvider: STTProviderInfo | null
  ttsProvider: TTSProviderInfo | null
  voiceOptions: VoiceOption[]
}

// 默认音色列表
export const DEFAULT_VOICE_OPTIONS: VoiceOption[] = [
  { id: "longxiaochun", name: "龙小淳", gender: "女" },
  { id: "longlaotie", name: "龙老铁", gender: "男" },
  { id: "longshu", name: "龙叔", gender: "男" },
  { id: "longshuo", name: "龙硕", gender: "男", language: "en" },
  { id: "longjielidou", name: "龙杰力豆", gender: "男" },
  { id: "longyue", name: "龙悦", gender: "女" },
  { id: "longwan", name: "龙婉", gender: "女" },
]

const BASE_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"

let cachedConfig: VoiceConfig | null = null

export function getVoiceConfig(): VoiceConfig {
  if (cachedConfig) return cachedConfig

  const apiKey = process.env.DASHSCOPE_API_KEY
  const enabled = process.env.VOICE_ENABLED === "true" && !!apiKey

  if (!enabled || !apiKey) {
    cachedConfig = {
      enabled: false,
      sttProvider: null,
      ttsProvider: null,
      voiceOptions: DEFAULT_VOICE_OPTIONS,
    }
    return cachedConfig
  }

  const voice = process.env.TTS_VOICE || "longxiaochun"

  cachedConfig = {
    enabled: true,
    sttProvider: {
      provider: "dashscope",
      model: "paraformer-realtime-v2",
      baseUrl: BASE_URL,
      languages: ["zh", "en", "ja", "ko"],
      apiKey,
    },
    ttsProvider: {
      provider: "dashscope",
      model: "cosyvoice-v1",
      baseUrl: BASE_URL,
      voice,
      sampleRate: 22050,
      apiKey,
    },
    voiceOptions: DEFAULT_VOICE_OPTIONS,
  }
  return cachedConfig
}

/** 重置缓存（测试用） */
export function _resetVoiceCache(): void {
  cachedConfig = null
}
