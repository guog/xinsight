import { z } from "zod"

export const EnergyConsumptionSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  equipmentName: z.string(),
  lineId: z.string(),
  lineName: z.string(),
  energyType: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.string(),
  shift: z.string(),
})

export const EnergyAlarmSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  equipmentName: z.string(),
  lineId: z.string(),
  lineName: z.string(),
  alarmType: z.string(),
  threshold: z.number(),
  actualValue: z.number(),
  unit: z.string(),
  timestamp: z.string(),
  status: z.string(),
})
