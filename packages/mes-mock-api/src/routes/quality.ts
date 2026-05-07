import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { inspectionRecords, defectRecords, spcData } from "../data"
import { InspectionRecordSchema, DefectRecordSchema, SPCDataPointSchema } from "../schemas/quality"
import { listResponse } from "../schemas/common"
import { z } from "zod"

export const qualityRoutes = new OpenAPIHono()

// 检验记录
const inspectionsRoute = createRoute({
  method: "get",
  path: "/inspections",
  tags: ["质量管理"],
  summary: "获取检验记录列表",
  request: {
    query: z.object({
      orderId: z.string().optional(),
      result: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "检验记录列表",
      content: { "application/json": { schema: listResponse(InspectionRecordSchema) } },
    },
  },
})
qualityRoutes.openapi(inspectionsRoute, (c) => {
  let result = [...inspectionRecords]
  const { orderId, result: res } = c.req.valid("query")
  if (orderId) result = result.filter((r) => r.orderId === orderId)
  if (res) result = result.filter((r) => r.result === res)
  return c.json({ data: result }, 200)
})

// 缺陷记录
const defectsRoute = createRoute({
  method: "get",
  path: "/defects",
  tags: ["质量管理"],
  summary: "获取缺陷记录列表",
  request: { query: z.object({ orderId: z.string().optional() }) },
  responses: {
    200: {
      description: "缺陷记录列表",
      content: { "application/json": { schema: listResponse(DefectRecordSchema) } },
    },
  },
})
qualityRoutes.openapi(defectsRoute, (c) => {
  let result = [...defectRecords]
  const orderId = c.req.valid("query").orderId
  if (orderId) result = result.filter((r) => r.orderId === orderId)
  return c.json({ data: result }, 200)
})

// SPC数据
const spcRoute = createRoute({
  method: "get",
  path: "/spc",
  tags: ["质量管理"],
  summary: "获取SPC数据",
  responses: {
    200: {
      description: "SPC数据列表",
      content: { "application/json": { schema: listResponse(SPCDataPointSchema) } },
    },
  },
})
qualityRoutes.openapi(spcRoute, (c) => c.json({ data: spcData }, 200))
