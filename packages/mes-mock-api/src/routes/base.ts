import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { productionLines, stations, shifts, teams, materials, personnel } from "../data"
import {
  ProductionLineSchema,
  StationSchema,
  ShiftSchema,
  TeamSchema,
  MaterialSchema,
  PersonnelSchema,
} from "../schemas/base"
import { listResponse } from "../schemas/common"
import { z } from "zod"

export const baseRoutes = new OpenAPIHono()

// 产线列表
const linesRoute = createRoute({
  method: "get",
  path: "/lines",
  tags: ["基础数据"],
  summary: "获取产线列表",
  responses: {
    200: {
      description: "产线列表",
      content: { "application/json": { schema: listResponse(ProductionLineSchema) } },
    },
  },
})
baseRoutes.openapi(linesRoute, (c) => c.json({ data: productionLines }, 200))

// 工位列表
const stationsRoute = createRoute({
  method: "get",
  path: "/stations",
  tags: ["基础数据"],
  summary: "获取工位列表",
  request: { query: z.object({ lineId: z.string().optional() }) },
  responses: {
    200: {
      description: "工位列表",
      content: { "application/json": { schema: listResponse(StationSchema) } },
    },
  },
})
baseRoutes.openapi(stationsRoute, (c) => {
  const lineId = c.req.valid("query").lineId
  const result = lineId ? stations.filter((s) => s.lineId === lineId) : stations
  return c.json({ data: result }, 200)
})

// 班次列表
const shiftsRoute = createRoute({
  method: "get",
  path: "/shifts",
  tags: ["基础数据"],
  summary: "获取班次列表",
  responses: {
    200: {
      description: "班次列表",
      content: { "application/json": { schema: listResponse(ShiftSchema) } },
    },
  },
})
baseRoutes.openapi(shiftsRoute, (c) => c.json({ data: shifts }, 200))

// 班组列表
const teamsRoute = createRoute({
  method: "get",
  path: "/teams",
  tags: ["基础数据"],
  summary: "获取班组列表",
  responses: {
    200: {
      description: "班组列表",
      content: { "application/json": { schema: listResponse(TeamSchema) } },
    },
  },
})
baseRoutes.openapi(teamsRoute, (c) => c.json({ data: teams }, 200))

// 物料列表
const materialsRoute = createRoute({
  method: "get",
  path: "/materials",
  tags: ["基础数据"],
  summary: "获取物料列表",
  request: { query: z.object({ category: z.string().optional() }) },
  responses: {
    200: {
      description: "物料列表",
      content: { "application/json": { schema: listResponse(MaterialSchema) } },
    },
  },
})
baseRoutes.openapi(materialsRoute, (c) => {
  const category = c.req.valid("query").category
  const result = category ? materials.filter((m) => m.category === category) : materials
  return c.json({ data: result }, 200)
})

// 人员列表
const personnelRoute = createRoute({
  method: "get",
  path: "/personnel",
  tags: ["基础数据"],
  summary: "获取人员列表",
  request: { query: z.object({ teamId: z.string().optional() }) },
  responses: {
    200: {
      description: "人员列表",
      content: { "application/json": { schema: listResponse(PersonnelSchema) } },
    },
  },
})
baseRoutes.openapi(personnelRoute, (c) => {
  const teamId = c.req.valid("query").teamId
  const result = teamId ? personnel.filter((p) => p.teamId === teamId) : personnel
  return c.json({ data: result }, 200)
})
