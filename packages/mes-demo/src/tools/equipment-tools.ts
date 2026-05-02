import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { equipmentList, maintenanceRecords, alarmRecords } from "../data"

export const queryEquipment = createTool({
  id: "query-equipment",
  description: "查询设备信息，可按产线ID或设备状态筛选。",
  inputSchema: z.object({
    lineId: z.string().optional().describe("产线ID"),
    status: z.enum(["运行中", "停机维护", "待机", "故障"]).optional().describe("设备状态"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = equipmentList
    if (context.lineId) {
      result = result.filter((e) => e.lineId === context.lineId)
    }
    if (context.status) {
      result = result.filter((e) => e.status === context.status)
    }
    return { total: result.length, data: result }
  },
})

export const queryMaintenance = createTool({
  id: "query-maintenance",
  description: "查询维保记录，可按设备ID或日期筛选。",
  inputSchema: z.object({
    equipmentId: z.string().optional().describe("设备ID"),
    date: z.string().optional().describe("日期筛选"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = maintenanceRecords
    if (context.equipmentId) {
      result = result.filter((r) => r.equipmentId === context.equipmentId)
    }
    if (context.date) {
      const d = new Date(context.date).toDateString()
      result = result.filter((r) => r.startTime.toDateString() === d)
    }
    return { total: result.length, data: result }
  },
})

export const queryAlarms = createTool({
  id: "query-alarms",
  description: "查询设备报警记录，可按严重程度或是否已确认筛选。",
  inputSchema: z.object({
    severity: z.enum(["紧急", "重要", "一般"]).optional().describe("报警严重程度"),
    acknowledged: z.boolean().optional().describe("是否已确认"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = alarmRecords
    if (context.severity) {
      result = result.filter((r) => r.severity === context.severity)
    }
    if (context.acknowledged !== undefined) {
      result = result.filter((r) => r.acknowledged === context.acknowledged)
    }
    return { total: result.length, data: result }
  },
})

export const getEquipmentSummary = createTool({
  id: "get-equipment-summary",
  description: "获取设备概况，包括设备可用率、各状态设备数量、报警统计等。",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    const total = equipmentList.length
    const statusCount: Record<string, number> = {}
    for (const e of equipmentList) {
      statusCount[e.status] = (statusCount[e.status] || 0) + 1
    }
    const running = statusCount["运行中"] || 0
    const availability = `${((running / total) * 100).toFixed(1)}%`
    const unacknowledgedAlarms = alarmRecords.filter((a) => !a.acknowledged).length

    return {
      totalEquipment: total,
      statusCount,
      availability,
      totalAlarms: alarmRecords.length,
      unacknowledgedAlarms,
    }
  },
})
