import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { productionLines, stations, materials, personnel, shifts, teams } from "../data"

export const queryProductionLines = createTool({
  id: "query-production-lines",
  description: "查询产线信息，可按产线ID筛选。返回产线列表及其工位信息。",
  inputSchema: z.object({
    lineId: z.string().optional().describe("产线ID，如 LINE-A"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let lines = productionLines
    if (context.lineId) {
      lines = lines.filter((l) => l.id === context.lineId)
    }
    const result = lines.map((line) => ({
      ...line,
      stations: stations.filter((s) => s.lineId === line.id),
    }))
    return { total: result.length, data: result }
  },
})

export const queryMaterials = createTool({
  id: "query-materials",
  description: "查询物料信息，可按分类（原材料/半成品/成品）或关键词筛选。",
  inputSchema: z.object({
    category: z.enum(["原材料", "半成品", "成品"]).optional().describe("物料分类"),
    keyword: z.string().optional().describe("按名称或编码搜索的关键词"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = materials
    if (context.category) {
      result = result.filter((m) => m.category === context.category)
    }
    if (context.keyword) {
      const kw = context.keyword.toLowerCase()
      result = result.filter(
        (m) => m.name.toLowerCase().includes(kw) || m.code.toLowerCase().includes(kw),
      )
    }
    return { total: result.length, data: result }
  },
})

export const queryPersonnel = createTool({
  id: "query-personnel",
  description: "查询人员信息，可按班组ID或角色筛选。",
  inputSchema: z.object({
    teamId: z.string().optional().describe("班组ID，如 TEAM-1"),
    role: z.string().optional().describe("角色，如 班组长、操作工、质检员"),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    let result = personnel
    if (context.teamId) {
      result = result.filter((p) => p.teamId === context.teamId)
    }
    if (context.role) {
      result = result.filter((p) => p.role === context.role)
    }
    return { total: result.length, data: result }
  },
})

export const queryShiftsTeams = createTool({
  id: "query-shifts-teams",
  description: "查询班次和班组信息，返回所有班次及班组数据。",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return { shifts, teams }
  },
})
