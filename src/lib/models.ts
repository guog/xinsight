/**
 * 模型注册表 — 环境变量驱动的 AI 模型提供商配置
 *
 * 模型 ID 格式：`provider/model-name`（Mastra provider registry 规范）
 */

export interface ModelInfo {
  /** 模型 ID，格式 provider/model-name */
  id: string
  /** 显示名称 */
  name: string
  /** 所属提供商 ID */
  providerId: string
  /** 模型短名（provider/ 后面的部分） */
  modelSlug: string
  /** 简短描述 */
  description?: string
}

export interface ProviderInfo {
  /** 提供商唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 需要的环境变量名 */
  envKey: string
  /** API Key */
  apiKey: string
  /** Base URL */
  baseUrl: string
  /** 该提供商下的模型列表 */
  models: ModelInfo[]
}

// === 提供商注册表元数据 ===

interface RegistryEntry {
  id: string
  name: string
  envKey: string
  envBaseUrl?: string
  envModels?: string
  defaultBaseUrl?: string
  defaultModels: string[]
}

const PROVIDER_REGISTRY: RegistryEntry[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    envBaseUrl: "DEEPSEEK_BASE_URL",
    envModels: "DEEPSEEK_MODELS",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "qwen",
    name: "阿里云百炼 (Qwen)",
    envKey: "DASHSCOPE_API_KEY",
    envBaseUrl: "QWEN_BASE_URL",
    envModels: "QWEN_MODELS",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModels: ["qwen-max", "qwen-plus", "qwen-turbo", "qwq-max"],
  },
  {
    id: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    envBaseUrl: "OPENAI_BASE_URL",
    envModels: "OPENAI_MODELS",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModels: ["gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    envBaseUrl: "ANTHROPIC_BASE_URL",
    envModels: "ANTHROPIC_MODELS",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModels: ["claude-sonnet-4-20250514"],
  },
]

// === 模块级缓存 ===

let _cachedProviders: ProviderInfo[] | null = null

function buildProviders(): ProviderInfo[] {
  // 读取启用的提供商列表
  const enabledIds = (process.env.LLM_PROVIDERS || "deepseek,qwen")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const result: ProviderInfo[] = []

  for (const id of enabledIds) {
    const entry = PROVIDER_REGISTRY.find((r) => r.id === id)
    if (!entry) continue

    // 必须有 API Key 才启用
    const apiKey = process.env[entry.envKey] || ""
    if (!apiKey) continue

    // 解析 baseUrl
    const baseUrl =
      (entry.envBaseUrl && process.env[entry.envBaseUrl]) || entry.defaultBaseUrl || ""

    // 解析模型列表
    const modelSlugs =
      entry.envModels && process.env[entry.envModels]
        ? process.env[entry.envModels]!.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : entry.defaultModels

    // 构建 ModelInfo 数组
    const models: ModelInfo[] = modelSlugs.map((slug) => ({
      id: `${entry.id}/${slug}`,
      name: slug,
      providerId: entry.id,
      modelSlug: slug,
    }))

    result.push({
      id: entry.id,
      name: entry.name,
      envKey: entry.envKey,
      apiKey,
      baseUrl,
      models,
    })
  }

  return result
}

function resolveProviders(): ProviderInfo[] {
  if (!_cachedProviders) {
    _cachedProviders = buildProviders()
  }
  return _cachedProviders
}

/** 清除缓存（仅测试用） */
export function _resetCache() {
  _cachedProviders = null
}

// === 导出函数 ===

export function getProviders(): ProviderInfo[] {
  return resolveProviders()
}

export function getModels(): ModelInfo[] {
  return resolveProviders().flatMap((p) => p.models)
}

export function getModelById(id: string): ModelInfo | undefined {
  return getModels().find((m) => m.id === id)
}

export function getDefaultModelId(): string {
  const models = getModels()
  return models.length > 0 ? models[0].id : "deepseek/deepseek-chat"
}

export function getProviderForModel(modelId: string): ProviderInfo | undefined {
  const providerId = modelId.split("/")[0]
  return resolveProviders().find((p) => p.id === providerId)
}
