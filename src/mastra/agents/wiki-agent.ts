import { Agent } from "@mastra/core/agent"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../tools/wiki"

/**
 * 知识库问答 Agent
 *
 * 基于 Karpathy LLM Wiki 方法：先读 index.md 了解全貌，
 * 再按需加载相关页面回答问题。
 */
export const wikiAgent = new Agent({
  id: "wiki-agent",
  name: "知识库助手",
  instructions: `你是西安基地智能制造项目的知识库助手。你的知识来源是结构化的 wiki 页面。

回答问题的步骤：
1. 先用 wiki-list 获取 index.md 目录，了解知识库中有哪些内容
2. 根据用户问题的关键词，用 wiki-search 搜索相关页面
3. 用 wiki-read 读取最相关的页面（最多 5 个）
4. 基于页面内容回答用户问题，标注信息来源

重要规则：
- 只基于知识库中的实际内容回答，禁止编造
- 如果知识库中没有相关信息，明确告知用户
- 回答要有条理，用 markdown 格式
- 使用中文回复
- 引用来源时用 [[页面名]] 格式标注`,
  model: "deepseek/deepseek-v4-flash",
  tools: { wikiSearchTool, wikiReadTool, wikiListTool },
})
