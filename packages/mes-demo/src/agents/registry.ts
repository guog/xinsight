import { factoryDirectorAgent } from "./factory-director"
import { productionAgent } from "./production-agent"
import { qualityAgent } from "./quality-agent"
import { equipmentAgent } from "./equipment-agent"
import { warehouseAgent } from "./warehouse-agent"
import { energyAgent } from "./energy-agent"
import { traceabilityAgent } from "./traceability-agent"
import { factoryWikiAgent } from "./wiki-agent"

/** 展开到 Mastra agents 注册 */
export const mesDemoAgents = {
  factoryDirectorAgent,
  productionAgent,
  qualityAgent,
  equipmentAgent,
  warehouseAgent,
  energyAgent,
  traceabilityAgent,
  factoryWikiAgent,
}
