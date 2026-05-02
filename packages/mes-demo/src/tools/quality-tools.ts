import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { inspectionRecords, defectRecords, spcData } from "../data"

export const queryInspections = createTool({
  id: "query-inspections",
  description: "查询质检记录，可按工单ID或检验结果筛选。",
  inputSchema: z.object({
    orderId: z.string().optional().describe("工单ID"),
    result: z.enum(["合格", "不合格"]).optional().describe("检验结果"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = inspectionRecords
    if (context.orderId) {
      result = result.filter((r) => r.orderId === context.orderId)
    }
    if (context.result) {
      result = result.filter((r) => r.result === context.result)
    }
    return { total: result.length, data: result }
  },
})

export const queryDefects = createTool({
  id: "query-defects",
  description: "查询缺陷记录，可按缺陷类型或工位筛选。",
  inputSchema: z.object({
    defectType: z.string().optional().describe("缺陷类型关键词"),
    stationId: z.string().optional().describe("工位ID"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = defectRecords
    if (context.defectType) {
      const kw = context.defectType.toLowerCase()
      result = result.filter((r) => r.defectType.toLowerCase().includes(kw))
    }
    if (context.stationId) {
      result = result.filter((r) => r.stationId === context.stationId)
    }
    return { total: result.length, data: result }
  },
})

export const getQualitySummary = createTool({
  id: "get-quality-summary",
  description: "获取质量概况，包括合格率、top缺陷类型、缺陷趋势等。",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    const total = inspectionRecords.length
    const passed = inspectionRecords.filter((r) => r.result === "合格").length
    const passRate = `${((passed / total) * 100).toFixed(1)}%`

    // top缺陷类型统计
    const defectTypeCount: Record<string, number> = {}
    for (const d of defectRecords) {
      defectTypeCount[d.defectType] = (defectTypeCount[d.defectType] || 0) + 1
    }
    const topDefects = Object.entries(defectTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))

    return {
      totalInspections: total,
      passedCount: passed,
      failedCount: total - passed,
      passRate,
      totalDefects: defectRecords.length,
      topDefects,
    }
  },
})

export const querySpcData = createTool({
  id: "query-spc-data",
  description: "查询SPC统计过程控制数据，可按参数ID筛选。",
  inputSchema: z.object({
    parameterId: z.string().optional().describe("参数ID"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = spcData
    if (context.parameterId) {
      result = result.filter((r) => r.parameterId === context.parameterId)
    }
    return { total: result.length, data: result }
  },
})
