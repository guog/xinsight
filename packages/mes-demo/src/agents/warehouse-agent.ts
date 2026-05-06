import { Agent } from "@mastra/core/agent"
import { queryInventory, queryInOutRecords, getInventoryAlerts } from "../tools"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const warehouseAgent = new Agent({
  id: "warehouse-agent",
  name: "仓储物流专员",
  description: "负责仓储物流问题：库存查询、出入库记录、库存预警、物料管理",
  instructions: `你是工厂的仓储物流专员，负责回答所有与仓库和物料相关的问题。

你的能力范围：
- 库存查询（当前库存、库位、批次）
- 出入库记录查询（入库/出库/调拨记录）
- 库存预警（低库存、超期、呆滞料）

回答原则：
1. 用具体数据说话，调用工具获取实时数据
2. 发现异常（如库存不足、呆滞料多）主动提醒
3. 给出补货建议或库存优化方案
4. 格式清晰，善用表格和列表
5. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    queryInventory,
    queryInOutRecords,
    getInventoryAlerts,
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
