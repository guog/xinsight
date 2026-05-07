import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { productionOrders, schedules, processRoutes } from "../data"
import { ProductionOrderSchema, ScheduleSchema, ProcessRouteSchema } from "../schemas/production"
import { listResponse, itemResponse, ErrorResponse } from "../schemas/common"
import { z } from "zod"

export const productionRoutes = new OpenAPIHono()

// 工单列表
const ordersRoute = createRoute({
  method: "get",
  path: "/orders",
  tags: ["生产管理"],
  summary: "获取生产工单列表",
  request: {
    query: z.object({
      lineId: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "工单列表",
      content: { "application/json": { schema: listResponse(ProductionOrderSchema) } },
    },
  },
})
productionRoutes.openapi(ordersRoute, (c) => {
  let result = [...productionOrders]
  const { lineId, status } = c.req.valid("query")
  if (lineId) result = result.filter((o) => o.lineId === lineId)
  if (status) result = result.filter((o) => o.status === status)
  return c.json({ data: result }, 200)
})

// 工单详情
const orderByIdRoute = createRoute({
  method: "get",
  path: "/orders/{id}",
  tags: ["生产管理"],
  summary: "获取工单详情",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "工单详情",
      content: { "application/json": { schema: itemResponse(ProductionOrderSchema) } },
    },
    404: {
      description: "未找到",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
})
productionRoutes.openapi(orderByIdRoute, (c) => {
  const order = productionOrders.find((o) => o.id === c.req.valid("param").id)
  if (!order) return c.json({ error: "Not found" }, 404)
  return c.json({ data: order }, 200)
})

// 排程列表
const schedulesRoute = createRoute({
  method: "get",
  path: "/schedules",
  tags: ["生产管理"],
  summary: "获取排程列表",
  request: { query: z.object({ lineId: z.string().optional() }) },
  responses: {
    200: {
      description: "排程列表",
      content: { "application/json": { schema: listResponse(ScheduleSchema) } },
    },
  },
})
productionRoutes.openapi(schedulesRoute, (c) => {
  let result = [...schedules]
  const lineId = c.req.valid("query").lineId
  if (lineId) result = result.filter((s) => s.lineId === lineId)
  return c.json({ data: result }, 200)
})

// 工艺路线
const processRoutesRoute = createRoute({
  method: "get",
  path: "/process-routes",
  tags: ["生产管理"],
  summary: "获取工艺路线列表",
  responses: {
    200: {
      description: "工艺路线列表",
      content: { "application/json": { schema: listResponse(ProcessRouteSchema) } },
    },
  },
})
productionRoutes.openapi(processRoutesRoute, (c) => c.json({ data: processRoutes }, 200))
