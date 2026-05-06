import { Agent } from "@mastra/core/agent"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const factoryWikiAgent = new Agent({
  id: "factory-wiki-agent",
  name: "知识库专员",
  description: "负责工艺知识、设备说明、操作规范、业务术语等知识性问答，不涉及实时生产数据",
  instructions: `你是工厂的知识库专员，负责回答工艺知识、设备说明、操作规范、业务术语等知识性问题。

你的能力范围：
- 工艺知识查询（工序参数标准、工艺要求）
- 设备说明查询（设备规格、操作手册）
- 操作规范查询（SOP、安全规程）
- 业务术语解释

回答原则：
1. 先搜索知识库，基于知识库内容回答
2. 如果知识库没有相关内容，如实告知并给出通用建议
3. 格式清晰，善用引用和列表
4. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
