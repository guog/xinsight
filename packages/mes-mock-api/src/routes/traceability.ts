import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { traceabilityRecords } from "../data"
import { TraceabilityRecordSchema } from "../schemas/traceability"
import { listResponse, itemResponse, ErrorResponse } from "../schemas/common"
import { z } from "zod"

export const traceabilityRoutes = new OpenAPIHono()

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["追溯管理"],
  summary: "获取追溯记录列表",
  request: { query: z.object({ orderId: z.string().optional(), batchNo: z.string().optional() }) },
  responses: {
    200: {
      description: "追溯记录列表",
      content: { "application/json": { schema: listResponse(TraceabilityRecordSchema) } },
    },
  },
})
traceabilityRoutes.openapi(listRoute, (c) => {
  let result = [...traceabilityRecords]
  const { orderId, batchNo } = c.req.valid("query")
  if (orderId) result = result.filter((r) => r.orderId === orderId)
  if (batchNo) result = result.filter((r) => r.batchNo === batchNo)
  return c.json({ data: result }, 200)
})

const byIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["追溯管理"],
  summary: "获取追溯详情",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "追溯详情",
      content: { "application/json": { schema: itemResponse(TraceabilityRecordSchema) } },
    },
    404: { description: "未找到", content: { "application/json": { schema: ErrorResponse } } },
  },
})
traceabilityRoutes.openapi(byIdRoute, (c) => {
  const item = traceabilityRecords.find((r) => r.id === c.req.valid("param").id)
  if (!item) return c.json({ error: "Not found" }, 404)
  return c.json({ data: item }, 200)
})
