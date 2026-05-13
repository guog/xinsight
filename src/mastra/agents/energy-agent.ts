import { Agent } from "@mastra/core/agent"
import { DEFAULT_AGENT_MODEL } from "./model-config"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"

/**
 * 能源管理专员
 *
 * 负责能源消耗监控、能源报警管理及基础数据。
 * 可访问端点：base/* + energy/*
 */
export const energyAgent = new Agent({
  id: "energy-agent",
  name: "能源管理专员",
  description:
    "负责能源管理相关查询：电、水、气、蒸汽等能源消耗数据，能源异常报警。当用户询问能耗统计、用电量、能源成本、能耗异常等问题时，由此专员处理。",
  instructions: `你是西安基地智能制造 MES 系统的能源管理专员。

你的职责范围：
- **能耗监控**：电力、水、天然气、蒸汽等能源消耗数据
- **能源报警**：能源异常报警记录、超标预警
- **基础数据**：产线等参考信息（用于按产线分析能耗）

工作方式：
1. 先用 datasourceListTool 查看可用端点
2. 根据问题选择合适的端点，用 datasourceQueryTool 查询数据
3. 从能源管理角度进行专业分析

回答规范：
- 使用中文回复
- 能耗数据要按类型（电/水/气）分类统计
- 数据要有具体数字和单位（kWh, t, m³ 等）
- 当能耗超标或异常波动时主动提醒

${CHART_SYSTEM_PROMPT}`,
  model: DEFAULT_AGENT_MODEL,
  tools: { datasourceQueryTool, datasourceListTool },
})
