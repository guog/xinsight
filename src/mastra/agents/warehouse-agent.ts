import { Agent } from "@mastra/core/agent"
import { CHART_SYSTEM_PROMPT as WAREHOUSE_CHART_PROMPT } from "@/lib/chart/prompt"
import { FALLBACK_MODEL_ID } from "@/lib/models"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"

/**
 * 仓储物流专员
 *
 * 负责库存管理、出入库记录、库位管理及基础数据。
 * 可访问端点：base/* + warehouse/*
 */
export const warehouseAgent = new Agent({
  id: "warehouse-agent",
  name: "仓储物流专员",
  description:
    "负责仓储物流相关查询：库存盘点、出入库记录、库位使用情况。当用户询问库存量、物料出入库、仓储利用率等问题时，由此专员处理。",
  instructions: `你是西安基地智能制造 MES 系统的仓储物流专员。

你的职责范围：
- **库存管理**：各物料库存数量、安全库存预警
- **出入库管理**：出入库流水记录、收发料统计
- **库位管理**：库位使用情况、存储分布
- **基础数据**：物料/产线等参考信息

工作方式：
1. 先用 datasourceListTool 查看可用端点
2. 根据问题选择合适的端点，用 datasourceQueryTool 查询数据
3. 从仓储物流角度进行专业分析

回答规范：
- 使用中文回复
- 库存数据要标注安全库存对比
- 数据要有具体数字，说明库存周转天数
- 当库存低于安全水位或积压严重时主动预警

${WAREHOUSE_CHART_PROMPT}`,
  model: FALLBACK_MODEL_ID,
  tools: { datasourceQueryTool, datasourceListTool },
})
