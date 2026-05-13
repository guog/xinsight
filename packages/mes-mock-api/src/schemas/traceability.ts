import { z } from "zod"

export const TraceabilityRecordSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  serialNumber: z.string(),
  orderId: z.string(),
  completedAt: z.coerce.date(),
  materials: z.array(
    z.object({
      materialId: z.string(),
      materialName: z.string(),
      batchNumber: z.string(),
      quantity: z.number(),
      unit: z.string(),
      supplierId: z.string(),
      supplierName: z.string(),
    }),
  ),
  processSteps: z.array(
    z.object({
      sequence: z.number(),
      name: z.string(),
      stationId: z.string(),
      stationName: z.string(),
      operatorId: z.string(),
      operatorName: z.string(),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      parameters: z.record(z.string(), z.any()).optional(),
    }),
  ),
  qualityChecks: z.array(
    z.object({
      inspectionId: z.string(),
      type: z.string(),
      result: z.string(),
      inspectorId: z.string(),
      inspectorName: z.string(),
      timestamp: z.coerce.date(),
      details: z.string(),
    }),
  ),
})
