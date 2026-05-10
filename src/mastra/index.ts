import { Mastra } from "@mastra/core"
import { createLogger } from "@mastra/core/logger"
import { Memory } from "@mastra/memory"
import { LibSQLStore } from "@mastra/libsql"

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
/** Mastra Memory — 基于 LibSQL 的对话记忆 + 观察性记忆 */
const memory = new Memory({
  storage: new LibSQLStore({
    id: "xinsight-memory",
    url: "file:./data/memory.db",
  }),
  options: {
    lastMessages: 20,
    observationalMemory: true,
  },
})

export const mastra = new Mastra({
  logger: createLogger({ name: "xinsight", level: "info" }),
  memory: { default: memory },
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
