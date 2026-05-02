import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { energyConsumption, energyAlarms } from "../data"

export const queryEnergyConsumption = createTool({
  id: "query-energy-consumption",
  description: "查询能耗数据，可按产线ID或日期筛选。返回电、水、气消耗量。",
  inputSchema: z.object({
    lineId: z.string().optional().describe("产线ID"),
    date: z.string().optional().describe("日期筛选"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = energyConsumption
    if (context.lineId) {
      result = result.filter((r) => r.lineId === context.lineId)
    }
    if (context.date) {
      const d = new Date(context.date).toDateString()
      result = result.filter((r) => r.date.toDateString() === d)
    }
    return { total: result.length, data: result }
  },
})

export const getEnergySummary = createTool({
  id: "get-energy-summary",
  description: "获取本周能耗概况，包括总用电量、总用水量、总用气量、平均单件能耗成本等。",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    const totalElectricity = energyConsumption.reduce((s, r) => s + r.electricity, 0)
    const totalWater = energyConsumption.reduce((s, r) => s + r.water, 0)
    const totalGas = energyConsumption.reduce((s, r) => s + r.gas, 0)
    const totalHours = energyConsumption.reduce((s, r) => s + r.productionHours, 0)
    const validRecords = energyConsumption.filter((r) => r.energyCostPerUnit > 0)
    const avgCostPerUnit =
      validRecords.length > 0
        ? (validRecords.reduce((s, r) => s + r.energyCostPerUnit, 0) / validRecords.length).toFixed(
            2,
          )
        : "0"

    return {
      totalElectricity: `${totalElectricity} kWh`,
      totalWater: `${totalWater.toFixed(1)} 吨`,
      totalGas: `${totalGas} m³`,
      totalProductionHours: totalHours,
      avgEnergyCostPerUnit: `${avgCostPerUnit} 元/件`,
    }
  },
})

export const queryEnergyAlarms = createTool({
  id: "query-energy-alarms",
  description: "查询能耗报警记录，可按状态筛选。",
  inputSchema: z.object({
    status: z.enum(["已处理", "未处理"]).optional().describe("报警状态"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = energyAlarms
    if (context.status) {
      result = result.filter((r) => r.status === context.status)
    }
    return { total: result.length, data: result }
  },
})
