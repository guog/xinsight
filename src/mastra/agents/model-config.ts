import { getDefaultModelId } from "@/lib/models"

const FALLBACK_MODEL = process.env.DEFAULT_MODEL_ID ?? "deepseek/deepseek-chat"

/**
 * Agent 构造时的默认模型 — 使用环境变量回退值，不触发 DB 查询。
 * 避免模块级副作用导致 DB 未就绪时启动崩溃。
 */
export const DEFAULT_AGENT_MODEL = FALLBACK_MODEL

/**
 * 运行时获取默认模型 — 优先从 DB 读取，失败时回退到环境变量。
 * 适用于需要实时反映后台配置变更的场景。
 */
export function getDefaultAgentModel(): string {
  try {
    return getDefaultModelId()
  } catch {
    return FALLBACK_MODEL
  }
}
