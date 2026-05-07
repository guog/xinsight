import { z } from "zod"

// 检验参数
const InspectionParameterSchema = z.object({
  name: z.string(),
  value: z.number(),
  standard: z.number(),
  tolerance: z.number(),
  pass: z.boolean(),
})

// 检验记录
export const InspectionRecordSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productName: z.string(),
  inspectorId: z.string(),
  inspectionDate: z.string(),
  result: z.enum(["合格", "不合格"]),
  sampleSize: z.number(),
  defectCount: z.number(),
  parameters: z.array(InspectionParameterSchema),
})

// 缺陷记录
export const DefectRecordSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  stationId: z.string(),
  productName: z.string(),
  defectType: z.string(),
  severity: z.enum(["严重", "一般", "轻微"]),
  description: z.string(),
  discoveredAt: z.string(),
  operatorId: z.string(),
  status: z.enum(["已处理", "处理中", "待处理"]),
})

// SPC数据点
export const SPCDataPointSchema = z.object({
  timestamp: z.string(),
  parameterId: z.string(),
  parameterName: z.string(),
  value: z.number(),
  ucl: z.number(),
  lcl: z.number(),
  cl: z.number(),
})
