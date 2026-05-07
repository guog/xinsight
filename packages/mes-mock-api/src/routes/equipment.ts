import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { equipmentList, maintenanceRecords, alarmRecords, spareParts } from "../data"
import {
  EquipmentSchema,
  MaintenanceRecordSchema,
  AlarmRecordSchema,
  SparePartSchema,
} from "../schemas/equipment"
import { listResponse, itemResponse, ErrorResponse } from "../schemas/common"
import { z } from "zod"

export const equipmentRoutes = new OpenAPIHono()

// 设备列表
const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["设备管理"],
  summary: "获取设备列表",
  request: {
    query: z.object({
      lineId: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "设备列表",
      content: { "application/json": { schema: listResponse(EquipmentSchema) } },
    },
  },
})
equipmentRoutes.openapi(listRoute, (c) => {
  let result = [...equipmentList]
  const { lineId, status } = c.req.valid("query")
  if (lineId) result = result.filter((e) => e.lineId === lineId)
  if (status) result = result.filter((e) => e.status === status)
  return c.json({ data: result }, 200)
})

// 维保记录
const maintenanceRoute = createRoute({
  method: "get",
  path: "/maintenance",
  tags: ["设备管理"],
  summary: "获取维保记录列表",
  responses: {
    200: {
      description: "维保记录列表",
      content: { "application/json": { schema: listResponse(MaintenanceRecordSchema) } },
    },
  },
})
equipmentRoutes.openapi(maintenanceRoute, (c) => c.json({ data: maintenanceRecords }, 200))

// 报警记录
const alarmsRoute = createRoute({
  method: "get",
  path: "/alarms",
  tags: ["设备管理"],
  summary: "获取设备报警记录",
  responses: {
    200: {
      description: "报警记录列表",
      content: { "application/json": { schema: listResponse(AlarmRecordSchema) } },
    },
  },
})
equipmentRoutes.openapi(alarmsRoute, (c) => c.json({ data: alarmRecords }, 200))

// 备件列表
const sparePartsRoute = createRoute({
  method: "get",
  path: "/spare-parts",
  tags: ["设备管理"],
  summary: "获取备件列表",
  responses: {
    200: {
      description: "备件列表",
      content: { "application/json": { schema: listResponse(SparePartSchema) } },
    },
  },
})
equipmentRoutes.openapi(sparePartsRoute, (c) => c.json({ data: spareParts }, 200))

// 设备详情
const byIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["设备管理"],
  summary: "获取设备详情",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "设备详情",
      content: { "application/json": { schema: itemResponse(EquipmentSchema) } },
    },
    404: {
      description: "未找到",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
})
equipmentRoutes.openapi(byIdRoute, (c) => {
  const item = equipmentList.find((e) => e.id === c.req.valid("param").id)
  if (!item) return c.json({ error: "Not found" }, 404)
  return c.json({ data: item }, 200)
})
