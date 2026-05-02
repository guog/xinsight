import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { productionOrders, schedules, processRoutes } from "../data"

export const queryProductionOrders = createTool({
  id: "query-production-orders",
  description: "查询生产工单，可按状态、日期、产品名称筛选。",
  inputSchema: z.object({
    status: z.enum(["已完成", "进行中", "已计划"]).optional().describe("工单状态"),
    date: z.string().optional().describe("日期筛选，如 2025-05-01"),
    product: z.string().optional().describe("产品名称关键词"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = productionOrders
    if (context.status) {
      result = result.filter((o) => o.status === context.status)
    }
    if (context.date) {
      const d = new Date(context.date).toDateString()
      result = result.filter((o) => o.plannedStart.toDateString() === d)
    }
    if (context.product) {
      const kw = context.product.toLowerCase()
      result = result.filter((o) => o.productName.toLowerCase().includes(kw))
    }
    return { total: result.length, data: result }
  },
})

export const queryProductionSchedule = createTool({
  id: "query-production-schedule",
  description: "查询排产计划，可按日期或产线筛选。",
  inputSchema: z.object({
    date: z.string().optional().describe("日期筛选"),
    lineId: z.string().optional().describe("产线ID"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = schedules
    if (context.date) {
      const d = new Date(context.date).toDateString()
      result = result.filter((s) => s.date.toDateString() === d)
    }
    if (context.lineId) {
      result = result.filter((s) => s.lineId === context.lineId)
    }
    return { total: result.length, data: result }
  },
})

export const queryProcessRoute = createTool({
  id: "query-process-route",
  description: "查询工艺路线，可按产品ID或产品名称筛选。返回产品的工序步骤。",
  inputSchema: z.object({
    productId: z.string().optional().describe("产品ID"),
    productName: z.string().optional().describe("产品名称关键词"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = processRoutes
    if (context.productId) {
      result = result.filter((r) => r.productId === context.productId)
    }
    if (context.productName) {
      const kw = context.productName.toLowerCase()
      result = result.filter((r) => r.productName.toLowerCase().includes(kw))
    }
    return { total: result.length, data: result }
  },
})

export const getProductionSummary = createTool({
  id: "get-production-summary",
  description: "获取本周生产概况统计，包括工单总数、完成率、总产出数量等。",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    const total = productionOrders.length
    const completed = productionOrders.filter((o) => o.status === "已完成")
    const inProgress = productionOrders.filter((o) => o.status === "进行中")
    const planned = productionOrders.filter((o) => o.status === "已计划")
    const totalOutput = productionOrders.reduce((sum, o) => sum + o.completedQty, 0)
    const totalPlanned = productionOrders.reduce((sum, o) => sum + o.quantity, 0)
    return {
      totalOrders: total,
      completedOrders: completed.length,
      inProgressOrders: inProgress.length,
      plannedOrders: planned.length,
      completionRate: `${((completed.length / total) * 100).toFixed(1)}%`,
      totalOutput,
      totalPlanned,
      outputRate: `${((totalOutput / totalPlanned) * 100).toFixed(1)}%`,
    }
  },
})
