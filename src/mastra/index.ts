import { Mastra } from "@mastra/core"

import { chatAgent } from "./agents/chat-agent"
import { researchAgent } from "./agents/research-agent"
import { codeAgent } from "./agents/code-agent"
import { autoAgent } from "./agents/auto-agent"
import { wikiAgent } from "./agents/wiki-agent"

/**
 * Mastra 实例 — 注册所有 Agent
 *
 * 核心 Agent：
 * - chatAgent: 通用聊天（默认）
 * - autoAgent: 自动模式切换
 * - researchAgent: 深度研究分析
 * - codeAgent: 代码编写与审查
 * - wikiAgent: 知识库问答
 */
export const mastra = new Mastra({
  agents: {
    chatAgent,
    autoAgent,
    researchAgent,
    codeAgent,
    wikiAgent,
  },
})
