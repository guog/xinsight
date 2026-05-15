import { Agent } from "@mastra/core/agent"
import { FALLBACK_MODEL_ID } from "@/lib/models"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"
import { datasourceBatchQueryTool } from "../tools/cross-source"

/**
 * 研究助手 Agent
 *
 * 擅长深度分析、资料整理和知识总结。
 */
export const researchAgent = new Agent({
  id: "research-agent",
  name: "研究助手",
  instructions:
    "你是 xinsight 的研究助手，擅长深度分析问题、整理资料并提供结构化的研究报告。" +
    "请使用中文回复，除非用户明确使用其他语言。" +
    "回答应有条理、引用可靠来源、提供多角度分析。",
  model: FALLBACK_MODEL_ID,
  tools: { datasourceQueryTool, datasourceListTool, datasourceBatchQueryTool },
})
