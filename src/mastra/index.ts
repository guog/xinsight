import { Mastra } from "@mastra/core"

import { factoryDirectorAgent } from "./agents/factory-director"
import { productionAgent } from "./agents/production-agent"
import { qualityAgent } from "./agents/quality-agent"
import { equipmentAgent } from "./agents/equipment-agent"
import { warehouseAgent } from "./agents/warehouse-agent"
import { energyAgent } from "./agents/energy-agent"
import { wikiAgent } from "./agents/wiki-agent"

/**
 * Mastra 实例 — 注册所有 Agent
 *
 * 架构：Supervisor + 域子 Agent
 * - factoryDirectorAgent: 厂长（Supervisor），统筹协调所有子 Agent
 * - productionAgent: 生产管理专员（base + production + traceability）
 * - qualityAgent: 质量管理专员（base + quality + traceability）
 * - equipmentAgent: 设备管理专员（base + equipment）
 * - warehouseAgent: 仓储物流专员（base + warehouse）
 * - energyAgent: 能源管理专员（base + energy）
 * - wikiAgent: 知识库专员（wiki 工具）
 */
export const mastra = new Mastra({
  agents: {
    factoryDirectorAgent,
    productionAgent,
    qualityAgent,
    equipmentAgent,
    warehouseAgent,
    energyAgent,
    wikiAgent,
  },
})
