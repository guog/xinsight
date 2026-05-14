import { Agent } from "@mastra/core/agent"
import { DEFAULT_AGENT_MODEL } from "./model-config"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"
import { datasourceBatchQueryTool } from "../tools/cross-source"
import { createDefaultScorers } from "./eval-config"

/**
 * 通用聊天 Agent
 *
 * 支持通过 requestContext.modelId 动态切换模型。
 * 模型格式：`provider/model-name`（Mastra provider registry 规范）。
 *
 * 已集成 Mastra Evals 评估机制：
 * - 回答相关性（Answer Relevancy）
 * - 毒性检测（Toxicity）
 * - 幻觉检测（Hallucination）
 */
export const chatAgent = new Agent({
  id: "chat-agent",
  name: "聊天助手",
  instructions:
    "你是 xinsight 的 AI 助手，擅长回答用户问题并提供有价值的洞察。" +
    "请使用中文回复，除非用户明确使用其他语言。" +
    "回答应简洁、准确、有帮助。",
  model: DEFAULT_AGENT_MODEL,
  tools: { datasourceQueryTool, datasourceListTool, datasourceBatchQueryTool },
  scorers: createDefaultScorers(),
})
