import { z } from "zod"

export const EnergyConsumptionSchema = z.object({
  id: z.string(),
  date: z.coerce.date(),
  lineId: z.string(),
  lineName: z.string(),
  electricity: z.number(),
  water: z.number(),
  gas: z.number(),
  productionHours: z.number(),
  energyCostPerUnit: z.number(),
})

export const EnergyAlarmSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  lineName: z.string(),
  type: z.string(),
  description: z.string(),
  timestamp: z.coerce.date(),
  value: z.number(),
  threshold: z.number(),
  unit: z.string(),
  status: z.string(),
})
