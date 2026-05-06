import { Agent } from "@mastra/core/agent"
import { queryInspections, queryDefects, getQualitySummary, querySpcData } from "../tools"
import { wikiSearchTool, wikiReadTool, wikiListTool } from "../../../../src/mastra/tools/wiki"

export const qualityAgent = new Agent({
  id: "quality-agent",
  name: "质量管理专员",
  description: "负责质量相关问题：质检记录、缺陷分析、良率统计、SPC过程控制",
  instructions: `你是工厂的质量管理专员，负责回答所有与质量相关的问题。

你的能力范围：
- 质检记录查询（检验批次、检验结果、判定）
- 缺陷分析（缺陷类型、分布、top问题）
- 良率/合格率统计汇总
- SPC统计过程控制数据（Cpk、控制图数据）

回答原则：
1. 用具体数据说话，调用工具获取实时数据
2. 发现异常（如良率下降、Cpk不足、缺陷集中）主动提醒
3. 给出可能的原因分析和改善建议
4. 格式清晰，善用表格和列表
5. 使用中文回复`,
  model: "deepseek/deepseek-v4-flash",
  tools: {
    queryInspections,
    queryDefects,
    getQualitySummary,
    querySpcData,
    wikiSearchTool,
    wikiReadTool,
    wikiListTool,
  },
})
