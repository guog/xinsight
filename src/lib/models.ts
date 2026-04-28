/**
 * 模型注册表 — 定义可用的 AI 模型提供商和模型
 *
 * 模型 ID 格式：`provider/model-name`（Mastra provider registry 规范）
 */

export interface ProviderInfo {
  /** 提供商唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 需要的环境变量名 */
  envKey: string
}

export interface ModelInfo {
  /** 模型 ID，格式 provider/model-name */
  id: string
  /** 显示名称 */
  name: string
  /** 所属提供商 ID */
  providerId: string
  /** 简短描述 */
  description?: string
}

const providers: ProviderInfo[] = [
  { id: "deepseek", name: "DeepSeek", envKey: "DEEPSEEK_API_KEY" },
  { id: "openai", name: "OpenAI", envKey: "OPENAI_API_KEY" },
  { id: "anthropic", name: "Anthropic", envKey: "ANTHROPIC_API_KEY" },
  { id: "google", name: "Google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY" },
  { id: "alibaba", name: "阿里通义千问", envKey: "DASHSCOPE_API_KEY" },
]

const models: ModelInfo[] = [
  // DeepSeek
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek Chat",
    providerId: "deepseek",
    description: "通用对话模型",
  },
  {
    id: "deepseek/deepseek-reasoner",
    name: "DeepSeek Reasoner",
    providerId: "deepseek",
    description: "推理增强模型",
  },
  // OpenAI
  { id: "openai/gpt-4o", name: "GPT-4o", providerId: "openai", description: "多模态旗舰模型" },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    providerId: "openai",
    description: "轻量快速模型",
  },
  // Anthropic
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    providerId: "anthropic",
    description: "平衡型模型",
  },
  // Google
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    providerId: "google",
    description: "快速多模态模型",
  },
  // 阿里通义千问
  {
    id: "alibaba/qwen-turbo",
    name: "通义千问 Turbo",
    providerId: "alibaba",
    description: "快速对话模型",
  },
  {
    id: "alibaba/qwen-plus",
    name: "通义千问 Plus",
    providerId: "alibaba",
    description: "增强对话模型",
  },
]

const DEFAULT_MODEL_ID = "deepseek/deepseek-chat"

export function getProviders(): ProviderInfo[] {
  return [...providers]
}

export function getModels(): ModelInfo[] {
  return [...models]
}

export function getModelById(id: string): ModelInfo | undefined {
  return models.find((m) => m.id === id)
}

export function getDefaultModelId(): string {
  return DEFAULT_MODEL_ID
}
