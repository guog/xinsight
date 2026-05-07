import { z } from "zod"

export const TraceabilityRecordSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  batchNo: z.string(),
  orderId: z.string(),
  processSteps: z.array(
    z.object({
      stepId: z.string(),
      stepName: z.string(),
      stationId: z.string(),
      stationName: z.string(),
      operatorId: z.string(),
      operatorName: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      result: z.string(),
      params: z.record(z.any()).optional(),
    }),
  ),
  materials: z.array(
    z.object({
      materialId: z.string(),
      materialName: z.string(),
      batchNo: z.string(),
      quantity: z.number(),
      unit: z.string(),
    }),
  ),
  qualityRecords: z.array(
    z.object({
      inspectionId: z.string(),
      type: z.string(),
      result: z.string(),
      timestamp: z.string(),
    }),
  ),
  createTime: z.string(),
})
