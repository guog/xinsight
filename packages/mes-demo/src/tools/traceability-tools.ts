import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { traceabilityRecords } from "../data"

export const traceProduct = createTool({
  id: "trace-product",
  description: "产品追溯，按产品ID、序列号或工单ID查询完整追溯链（物料→工序→质检→人员）。",
  inputSchema: z.object({
    productId: z.string().optional().describe("产品ID"),
    serialNumber: z.string().optional().describe("产品序列号"),
    orderId: z.string().optional().describe("工单ID"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = traceabilityRecords
    if (context.productId) {
      result = result.filter((r) => r.productId === context.productId)
    }
    if (context.serialNumber) {
      result = result.filter((r) => r.serialNumber === context.serialNumber)
    }
    if (context.orderId) {
      result = result.filter((r) => r.orderId === context.orderId)
    }
    return { total: result.length, data: result }
  },
})

export const traceMaterial = createTool({
  id: "trace-material",
  description: "物料追溯，按物料ID或批次号查询该物料被用于哪些产品。",
  inputSchema: z.object({
    materialId: z.string().optional().describe("物料ID"),
    batchNumber: z.string().optional().describe("物料批次号"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const result = traceabilityRecords.filter((r) =>
      r.materials.some((m) => {
        if (context.materialId && m.materialId !== context.materialId) return false
        if (context.batchNumber && m.batchNumber !== context.batchNumber) return false
        return true
      }),
    )
    const data = result.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      serialNumber: r.serialNumber,
      orderId: r.orderId,
      completedAt: r.completedAt,
      matchedMaterials: r.materials.filter((m) => {
        if (context.materialId && m.materialId !== context.materialId) return false
        if (context.batchNumber && m.batchNumber !== context.batchNumber) return false
        return true
      }),
    }))
    return { total: data.length, data }
  },
})
