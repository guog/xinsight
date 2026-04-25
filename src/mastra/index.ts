import { Mastra } from "@mastra/core"

import { chatAgent } from "./agents"

/**
 * Mastra 实例 — 注册所有 Agent、Tool 和 Workflow
 *
 * 在 Next.js API Routes 中通过 `mastra.getAgent("chat-agent")` 获取 Agent。
 */
export const mastra = new Mastra({
  agents: { chatAgent },
})
