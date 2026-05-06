import { Mastra } from "@mastra/core"

import { mesDemoAgents } from "@xinsight/mes-demo"

/**
 * Mastra 实例 — 注册所有 Agent
 *
 * 核心入口是 factoryDirectorAgent（厂长 Supervisor），
 * 其余子 Agent 由厂长自动调度，无需用户手动选择。
 */
export const mastra = new Mastra({
  agents: { ...mesDemoAgents },
})
