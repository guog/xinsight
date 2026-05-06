import { Agent } from "@mastra/core/agent"
import { queryEquipment, queryMaintenance, queryAlarms, getEquipmentSummary } from "../tools"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const equipmentAgent = new Agent({
  id: "equipment-agent",
  name: "设备管理专员",
  description: "负责设备相关问题：设备状态、OEE、维保记录、故障报警",
  instructions: `你是工厂的设备管理专员，负责回答所有与设备相关的问题。

你的能力范围：
- 设备状态查询（运行/停机/维修/待机）
- 设备综合效率OEE统计
- 维保记录查询（计划性维保、故障维修）
- 报警信息查询（当前活跃报警、历史报警）

回答原则：
1. 用具体数据说话，调用工具获取实时数据
2. 发现异常（如OEE低、报警频繁、维保逾期）主动提醒
3. 给出设备健康评估和维护建议
4. 格式清晰，善用表格和列表
5. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    queryEquipment,
    queryMaintenance,
    queryAlarms,
    getEquipmentSummary,
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
