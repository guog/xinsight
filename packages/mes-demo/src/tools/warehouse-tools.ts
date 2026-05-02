import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { inventoryRecords, inOutRecords, warehouseLocations, materials } from "../data"

export const queryInventory = createTool({
  id: "query-inventory",
  description: "查询库存信息，可按物料ID或库区筛选。",
  inputSchema: z.object({
    materialId: z.string().optional().describe("物料ID"),
    zone: z.string().optional().describe("库区，如 A、B、C"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = inventoryRecords
    if (context.materialId) {
      result = result.filter((r) => r.materialId === context.materialId)
    }
    if (context.zone) {
      const zoneLocations = warehouseLocations
        .filter((l) => l.zone === context.zone)
        .map((l) => l.id)
      result = result.filter((r) => zoneLocations.includes(r.locationId))
    }
    return { total: result.length, data: result }
  },
})

export const queryInOutRecords = createTool({
  id: "query-in-out-records",
  description: "查询出入库记录，可按类型（入库/出库）或日期筛选。",
  inputSchema: z.object({
    type: z.enum(["入库", "出库"]).optional().describe("出入库类型"),
    date: z.string().optional().describe("日期筛选"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = inOutRecords
    if (context.type) {
      result = result.filter((r) => r.type === context.type)
    }
    if (context.date) {
      const d = new Date(context.date).toDateString()
      result = result.filter((r) => r.timestamp.toDateString() === d)
    }
    return { total: result.length, data: result }
  },
})

export const getInventoryAlerts = createTool({
  id: "get-inventory-alerts",
  description: "获取库存预警信息，返回低于安全库存的物料列表。",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    // 简单规则：原材料库存低于50为预警，半成品低于20，成品低于30
    const thresholds: Record<string, number> = { 原材料: 50, 半成品: 20, 成品: 30 }
    const alerts = inventoryRecords
      .map((inv) => {
        const mat = materials.find((m) => m.id === inv.materialId)
        const threshold = mat ? thresholds[mat.category] || 30 : 30
        return {
          ...inv,
          category: mat?.category,
          threshold,
          belowThreshold: inv.quantity < threshold,
        }
      })
      .filter((a) => a.belowThreshold)
    return { totalAlerts: alerts.length, data: alerts }
  },
})
