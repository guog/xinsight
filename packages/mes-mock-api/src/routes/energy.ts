import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { energyConsumption, energyAlarms } from "../data"
import { EnergyConsumptionSchema, EnergyAlarmSchema } from "../schemas/energy"
import { listResponse } from "../schemas/common"
import { z } from "zod"

export const energyRoutes = new OpenAPIHono()

const consumptionRoute = createRoute({
  method: "get",
  path: "/consumption",
  tags: ["能源管理"],
  summary: "获取能耗数据",
  request: {
    query: z.object({ lineId: z.string().optional(), energyType: z.string().optional() }),
  },
  responses: {
    200: {
      description: "能耗数据列表",
      content: { "application/json": { schema: listResponse(EnergyConsumptionSchema) } },
    },
  },
})
energyRoutes.openapi(consumptionRoute, (c) => {
  let result = [...energyConsumption]
  const { lineId, energyType } = c.req.valid("query")
  if (lineId) result = result.filter((r) => r.lineId === lineId)
  if (energyType) result = result.filter((r) => r.energyType === energyType)
  return c.json({ data: result }, 200)
})

const alarmsRoute = createRoute({
  method: "get",
  path: "/alarms",
  tags: ["能源管理"],
  summary: "获取能源报警",
  responses: {
    200: {
      description: "能源报警列表",
      content: { "application/json": { schema: listResponse(EnergyAlarmSchema) } },
    },
  },
})
energyRoutes.openapi(alarmsRoute, (c) => c.json({ data: energyAlarms }, 200))
