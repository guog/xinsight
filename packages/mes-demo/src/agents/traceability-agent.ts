import { Agent } from "@mastra/core/agent"
import { traceProduct, traceMaterial, queryMaterials } from "../tools"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const traceabilityAgent = new Agent({
  id: "traceability-agent",
  name: "追溯管理专员",
  description: "负责追溯相关问题：产品全链路追溯、物料去向追溯、批次追踪",
  instructions: `你是工厂的追溯管理专员，负责回答所有与产品追溯和物料追踪相关的问题。

你的能力范围：
- 产品正向追溯（从原料到成品的全链路）
- 物料反向追溯（成品用了哪些批次原料）
- 物料基础信息查询

回答原则：
1. 用具体数据说话，调用工具获取实时数据
2. 追溯信息要完整，包含时间、批次、工序、操作人等关键节点
3. 格式清晰，善用流程图描述和列表
4. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    traceProduct,
    traceMaterial,
    queryMaterials,
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
