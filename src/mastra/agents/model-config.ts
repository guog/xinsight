import { getDefaultModelId } from "@/lib/models"

/**
 * Agent 默认模型 — 从 DB 动态获取，避免硬编码。
 * 管理员在后台修改模型配置即可全局生效。
 */
export const DEFAULT_AGENT_MODEL = getDefaultModelId()
