import { z } from "zod"

// 设备
export const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  lineId: z.string(),
  stationId: z.string(),
  model: z.string(),
  manufacturer: z.string(),
  installDate: z.string(),
  status: z.enum(["运行中", "停机维护", "待机", "故障"]),
})

// 维保记录
export const MaintenanceRecordSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  equipmentName: z.string(),
  type: z.enum(["预防性维护", "故障维修", "定期保养"]),
  description: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  technicianId: z.string(),
  status: z.enum(["已完成", "进行中"]),
  cost: z.number(),
  spareParts: z.array(z.string()),
})

// 报警记录
export const AlarmRecordSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  equipmentName: z.string(),
  alarmType: z.string(),
  severity: z.enum(["紧急", "重要", "一般"]),
  description: z.string(),
  timestamp: z.string(),
  acknowledged: z.boolean(),
  resolvedAt: z.string().optional(),
})

// 备件
export const SparePartSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  applicableEquipment: z.array(z.string()),
  stock: z.number(),
  minStock: z.number(),
  unit: z.string(),
  unitPrice: z.number(),
})
