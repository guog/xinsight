import { Agent } from "@mastra/core/agent"
import { queryEnergyConsumption, getEnergySummary, queryEnergyAlarms } from "../tools"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const energyAgent = new Agent({
  id: "energy-agent",
  name: "能源管理专员",
  description: "负责能源相关问题：水电气能耗数据、能耗报警、节能分析",
  instructions: `你是工厂的能源管理专员，负责回答所有与能源消耗相关的问题。

你的能力范围：
- 能耗数据查询（电、水、天然气、压缩空气用量）
- 能耗汇总统计（日/周/月能耗趋势）
- 能耗报警（超标预警、异常用能）

回答原则：
1. 用具体数据说话，调用工具获取实时数据
2. 发现异常（如能耗突增、超标）主动提醒
3. 给出节能建议和优化方向
4. 格式清晰，善用表格和列表
5. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    queryEnergyConsumption,
    getEnergySummary,
    queryEnergyAlarms,
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
