import { z } from "zod"

// 产线
export const ProductionLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  stationCount: z.number(),
})

// 工位
export const StationSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  name: z.string(),
  type: z.string(),
  sequence: z.number(),
})

// 班次
export const ShiftSchema = z.object({
  id: z.string(),
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
})

// 班组
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  leader: z.string(),
  memberCount: z.number(),
})

// 物料
export const MaterialSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  category: z.enum(["原材料", "半成品", "成品"]),
  unit: z.string(),
  specification: z.string(),
})

// 人员
export const PersonnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string(),
  role: z.string(),
  skillLevel: z.enum(["初级", "中级", "高级"]),
  certifications: z.array(z.string()),
})
