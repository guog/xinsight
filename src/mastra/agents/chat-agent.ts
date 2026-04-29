import { Agent } from "@mastra/core/agent"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"
import { datasourceBatchQueryTool } from "../tools/cross-source"
import {
  createAnswerRelevancyScorer,
  createToxicityScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/prebuilt"

/**
 * 评估模型 — 用于对 Agent 输出进行自动评分
 * 使用较轻量的模型降低评估成本
 */
const evalModel = "deepseek/deepseek-chat"

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
  model: "deepseek/deepseek-chat",
  tools: { datasourceQueryTool, datasourceListTool, datasourceBatchQueryTool },
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: evalModel }),
      sampling: { type: "ratio", rate: 0.5 },
    },
    toxicity: {
      scorer: createToxicityScorer({ model: evalModel }),
      sampling: { type: "ratio", rate: 0.3 },
    },
    hallucination: {
      scorer: createHallucinationScorer({ model: evalModel }),
      sampling: { type: "ratio", rate: 0.3 },
    },
  },
})
