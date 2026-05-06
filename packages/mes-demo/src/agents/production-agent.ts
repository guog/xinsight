import { Agent } from "@mastra/core/agent"
import {
  queryProductionOrders,
  queryProductionSchedule,
  queryProcessRoute,
  getProductionSummary,
  queryProductionLines,
  queryShiftsTeams,
} from "../tools"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const productionAgent = new Agent({
  id: "production-agent",
  name: "生产管理专员",
  description: "负责生产相关问题：工单查询、排产计划、工艺路线、产量统计、产线信息、班次班组",
  instructions: `你是工厂的生产管理专员，负责回答所有与生产相关的问题。

你的能力范围：
- 生产工单查询（状态、进度、计划数量、实际产量）
- 排产计划查看（日/周排产安排）
- 工艺路线查询（工序、工位、节拍）
- 产量统计汇总（产量、达成率、趋势）
- 产线基础信息（产线列表、工位）
- 班次班组信息

回答原则：
1. 用具体数据说话，调用工具获取实时数据
2. 发现异常（如达成率低、排产冲突）主动提醒
3. 格式清晰，善用表格和列表
4. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    queryProductionOrders,
    queryProductionSchedule,
    queryProcessRoute,
    getProductionSummary,
    queryProductionLines,
    queryShiftsTeams,
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
