import { Agent } from "@mastra/core/agent"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"
import { datasourceBatchQueryTool } from "../tools/cross-source"
import { wikiSearchTool, wikiReadTool, wikiIngestTool } from "../tools/wiki"

/**
 * 代码助手 Agent
 *
 * 擅长代码编写、审查和调试。
 */
export const codeAgent = new Agent({
  id: "code-agent",
  name: "代码助手",
  instructions:
    "你是 xinsight 的代码助手，擅长编写、审查和调试代码。" +
    "请使用中文解释代码逻辑，代码本身使用标准英文。" +
    "遵循最佳实践，代码应简洁、可读、可维护。",
  model: "deepseek/deepseek-chat",
  tools: { datasourceQueryTool, datasourceListTool, datasourceBatchQueryTool },
})
