import { Agent } from "@mastra/core/agent"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"
import {
  datasourceBatchQueryTool,
  wikiSearchTool,
  wikiReadTool,
  wikiIngestTool,
} from "../tools/cross-source"
import { wikiSearchTool, wikiReadTool, wikiIngestTool } from "../tools/wiki"

export const autoAgent = new Agent({
  id: "auto-agent",
  name: "自动",
  model: "deepseek/deepseek-chat",
  instructions:
    "你是 xinsight AI 助手，能够根据用户需求自动切换工作模式：\n" +
    "\n" +
    "【聊天模式】用于日常对话、问答、翻译、创意写作等\n" +
    "- 友好、简洁、自然地回答\n" +
    "\n" +
    "【研究模式】用于深度分析、调研、数据解读、报告撰写\n" +
    "- 结构化输出，引用数据源，提供多角度分析\n" +
    "\n" +
    "【代码模式】用于代码编写、调试、代码审查、技术架构讨论\n" +
    "- 提供完整可运行的代码，包含注释和最佳实践\n" +
    "\n" +
    "根据用户消息自动选择最合适的模式，直接回答，无需告知使用了哪个模式。\n" +
    "如果用户查询涉及已配置的数据源，主动使用数据源工具获取实时数据。",
  tools: {
    datasourceQuery: datasourceQueryTool,
    datasourceList: datasourceListTool,
    datasourceBatchQuery: datasourceBatchQueryTool,
  },
})
