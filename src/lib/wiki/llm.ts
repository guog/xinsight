import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { getDefaultModelId } from "@/lib/models"

/**
 * Wiki 子系统共享的 LLM Provider
 * 使用 openai-compatible 以避免 @ai-sdk/openai v3+ 默认走 Responses API（DeepSeek 不支持）
 */
export const wikiLLMProvider = createOpenAICompatible({
  name: "deepseek",
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
})

/** 获取 wiki 用的模型 slug（去掉 provider 前缀）*/
export function getWikiModelSlug(): string {
  const fullId = process.env.WIKI_MODEL_ID || getDefaultModelId()
  return fullId.includes("/") ? fullId.split("/").slice(1).join("/") : fullId
}
