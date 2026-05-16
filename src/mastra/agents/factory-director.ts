import { Agent } from "@mastra/core/agent"
import { FALLBACK_MODEL_ID } from "@/lib/models"
import { CHART_SYSTEM_PROMPT as DIRECTOR_CHART_PROMPT } from "@/lib/chart/prompt"
import { productionAgent } from "./production-agent"
import { qualityAgent } from "./quality-agent"
import { equipmentAgent } from "./equipment-agent"
import { warehouseAgent } from "./warehouse-agent"
import { energyAgent } from "./energy-agent"
import { wikiAgent } from "./wiki-agent"
import { createDefaultScorers } from "./eval-config"
import { buildSupervisorInstructions } from "./supervisor-router"

/**
 * 厂长 Supervisor Agent
 *
 * 静态注册用于 Mastra 初始化，运行时通过 buildSupervisorInstructions 动态生成指令。
 */
export const factoryDirectorAgent = new Agent({
  id: "factory-director",
  name: "智能制造厂长",
  instructions: buildSupervisorInstructions(
    [
      {
        id: "production-agent",
        name: "生产管理专员",
        description: "生产工单、排程、工艺路线、追溯、产线/工位/人员等基础数据",
        keywords: [],
      },
      {
        id: "quality-agent",
        name: "质量管理专员",
        description: "质量检验、缺陷分析、SPC、良品率",
        keywords: [],
      },
      {
        id: "equipment-agent",
        name: "设备管理专员",
        description: "设备状态、故障报警、维保、备件",
        keywords: [],
      },
      {
        id: "warehouse-agent",
        name: "仓储物流专员",
        description: "库存、出入库、库位管理",
        keywords: [],
      },
      { id: "energy-agent", name: "能源管理专员", description: "能耗数据、能源报警", keywords: [] },
      { id: "wiki-agent", name: "知识库专员", description: "工厂知识库查询", keywords: [] },
    ],
    undefined,
    DIRECTOR_CHART_PROMPT,
  ),
  model: FALLBACK_MODEL_ID,
  agents: {
    productionAgent,
    qualityAgent,
    equipmentAgent,
    warehouseAgent,
    energyAgent,
    wikiAgent,
  },
  scorers: createDefaultScorers(),
})
