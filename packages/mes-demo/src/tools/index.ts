// 基础数据工具
export {
  queryProductionLines,
  queryMaterials,
  queryPersonnel,
  queryShiftsTeams,
} from "./base-tools"

// 生产管理工具
export {
  queryProductionOrders,
  queryProductionSchedule,
  queryProcessRoute,
  getProductionSummary,
} from "./production-tools"

// 质量管理工具
export { queryInspections, queryDefects, getQualitySummary, querySpcData } from "./quality-tools"

// 设备管理工具
export {
  queryEquipment,
  queryMaintenance,
  queryAlarms,
  getEquipmentSummary,
} from "./equipment-tools"

// 仓库物流工具
export { queryInventory, queryInOutRecords, getInventoryAlerts } from "./warehouse-tools"

// 能源管理工具
export { queryEnergyConsumption, getEnergySummary, queryEnergyAlarms } from "./energy-tools"

// 追溯工具
export { traceProduct, traceMaterial } from "./traceability-tools"

// 聚合导出
import {
  queryProductionLines,
  queryMaterials,
  queryPersonnel,
  queryShiftsTeams,
} from "./base-tools"
import {
  queryProductionOrders,
  queryProductionSchedule,
  queryProcessRoute,
  getProductionSummary,
} from "./production-tools"
import { queryInspections, queryDefects, getQualitySummary, querySpcData } from "./quality-tools"
import {
  queryEquipment,
  queryMaintenance,
  queryAlarms,
  getEquipmentSummary,
} from "./equipment-tools"
import { queryInventory, queryInOutRecords, getInventoryAlerts } from "./warehouse-tools"
import { queryEnergyConsumption, getEnergySummary, queryEnergyAlarms } from "./energy-tools"
import { traceProduct, traceMaterial } from "./traceability-tools"

export const mesTools = {
  queryProductionLines,
  queryMaterials,
  queryPersonnel,
  queryShiftsTeams,
  queryProductionOrders,
  queryProductionSchedule,
  queryProcessRoute,
  getProductionSummary,
  queryInspections,
  queryDefects,
  getQualitySummary,
  querySpcData,
  queryEquipment,
  queryMaintenance,
  queryAlarms,
  getEquipmentSummary,
  queryInventory,
  queryInOutRecords,
  getInventoryAlerts,
  queryEnergyConsumption,
  getEnergySummary,
  queryEnergyAlarms,
  traceProduct,
  traceMaterial,
}
