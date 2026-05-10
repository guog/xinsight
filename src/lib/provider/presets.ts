/**
 * 提供商预设模板 — 新建提供商和 env seed 时使用
 */
export interface ProviderPreset {
  id: string
  name: string
  type: "cloud" | "local"
  apiFormat: "openai" | "ollama"
  defaultBaseUrl: string
  apiKeyRequired: boolean
  envKey?: string // 对应的环境变量名（用于 seed）
  envBaseUrl?: string
  envModels?: string
  defaultModels: string[]
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  // 云端
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    apiKeyRequired: true,
    envKey: "DEEPSEEK_API_KEY",
    envBaseUrl: "DEEPSEEK_BASE_URL",
    envModels: "DEEPSEEK_MODELS",
    defaultModels: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  qwen: {
    id: "qwen",
    name: "阿里云百炼 (Qwen)",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyRequired: true,
    envKey: "DASHSCOPE_API_KEY",
    envBaseUrl: "QWEN_BASE_URL",
    envModels: "QWEN_MODELS",
    defaultModels: ["qwen-max", "qwen-plus", "qwen-turbo", "qwq-max"],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    apiKeyRequired: true,
    envKey: "OPENAI_API_KEY",
    envBaseUrl: "OPENAI_BASE_URL",
    envModels: "OPENAI_MODELS",
    defaultModels: ["gpt-4o", "gpt-4o-mini"],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://api.anthropic.com",
    apiKeyRequired: true,
    envKey: "ANTHROPIC_API_KEY",
    envBaseUrl: "ANTHROPIC_BASE_URL",
    envModels: "ANTHROPIC_MODELS",
    defaultModels: ["claude-sonnet-4-20250514"],
  },
  // 本地
  ollama: {
    id: "ollama",
    name: "Ollama",
    type: "local",
    apiFormat: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    apiKeyRequired: false,
    defaultModels: [],
  },
  litellm: {
    id: "litellm",
    name: "LiteLLM",
    type: "local",
    apiFormat: "openai",
    defaultBaseUrl: "http://localhost:4000/v1",
    apiKeyRequired: false,
    defaultModels: [],
  },
  vllm: {
    id: "vllm",
    name: "vLLM",
    type: "local",
    apiFormat: "openai",
    defaultBaseUrl: "http://localhost:8000/v1",
    apiKeyRequired: false,
    defaultModels: [],
  },
  localai: {
    id: "localai",
    name: "LocalAI",
    type: "local",
    apiFormat: "openai",
    defaultBaseUrl: "http://localhost:8080/v1",
    apiKeyRequired: false,
    defaultModels: [],
  },
}

/** 获取所有预设列表 */
export function getPresets(): ProviderPreset[] {
  return Object.values(PROVIDER_PRESETS)
}

/** 获取按类型分组的预设 */
export function getPresetsByType() {
  const presets = getPresets()
  return {
    cloud: presets.filter((p) => p.type === "cloud"),
    local: presets.filter((p) => p.type === "local"),
  }
}
