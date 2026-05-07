import { z } from "zod"

// 工序步骤
export const ProcessStepSchema = z.object({
  sequence: z.number(),
  name: z.string(),
  stationId: z.string(),
  standardTime: z.number(),
  description: z.string(),
})

// 生产工单
export const ProductionOrderSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  lineId: z.string(),
  quantity: z.number(),
  completedQty: z.number(),
  status: z.enum(["已完成", "进行中", "已计划"]),
  plannedStart: z.string(),
  plannedEnd: z.string(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  priority: z.enum(["高", "中", "低"]),
})

// 排程
export const ScheduleSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  shiftId: z.string(),
  teamId: z.string(),
  date: z.string(),
  lineId: z.string(),
})

// 工艺路线
export const ProcessRouteSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  steps: z.array(ProcessStepSchema),
})
