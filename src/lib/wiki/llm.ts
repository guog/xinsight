import { createOpenAI } from "@ai-sdk/openai"
import { getDefaultModelId } from "@/lib/models"

/**
 * Wiki 子系统共享的 LLM Provider
 * 从 DB 获取默认模型配置，支持通过环境变量覆盖
 */
export const wikiLLMProvider = createOpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
})

/** 获取 wiki 用的模型 slug（去掉 provider 前缀）*/
export function getWikiModelSlug(): string {
  const fullId = process.env.WIKI_MODEL_ID || getDefaultModelId()
  return fullId.includes("/") ? fullId.split("/").slice(1).join("/") : fullId
}
