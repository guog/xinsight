import { z } from "zod"

// 库存记录
export const InventoryRecordSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  materialName: z.string(),
  locationId: z.string(),
  quantity: z.number(),
  unit: z.string(),
  lastUpdated: z.string(),
})

// 出入库记录
export const InOutRecordSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  materialName: z.string(),
  type: z.enum(["入库", "出库"]),
  quantity: z.number(),
  unit: z.string(),
  orderId: z.string().optional(),
  reason: z.string(),
  operatorId: z.string(),
  timestamp: z.string(),
  locationId: z.string(),
})

// 库位
export const WarehouseLocationSchema = z.object({
  id: z.string(),
  zone: z.string(),
  zoneName: z.string(),
  slotNumber: z.string(),
  capacity: z.number(),
  currentLoad: z.number(),
  materialType: z.enum(["原材料", "半成品", "成品", "空"]),
})
