import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { inventoryRecords, inOutRecords, warehouseLocations } from "../data"
import {
  InventoryRecordSchema,
  InOutRecordSchema,
  WarehouseLocationSchema,
} from "../schemas/warehouse"
import { listResponse } from "../schemas/common"
import { z } from "zod"

export const warehouseRoutes = new OpenAPIHono()

const inventoryRoute = createRoute({
  method: "get",
  path: "/inventory",
  tags: ["仓储物流"],
  summary: "获取库存记录",
  request: { query: z.object({ materialId: z.string().optional() }) },
  responses: {
    200: {
      description: "库存列表",
      content: { "application/json": { schema: listResponse(InventoryRecordSchema) } },
    },
  },
})
warehouseRoutes.openapi(inventoryRoute, (c) => {
  let result = [...inventoryRecords]
  const { materialId } = c.req.valid("query")
  if (materialId) result = result.filter((r) => r.materialId === materialId)
  return c.json({ data: result }, 200)
})

const inOutRoute = createRoute({
  method: "get",
  path: "/in-out",
  tags: ["仓储物流"],
  summary: "获取出入库记录",
  request: { query: z.object({ type: z.string().optional() }) },
  responses: {
    200: {
      description: "出入库记录列表",
      content: { "application/json": { schema: listResponse(InOutRecordSchema) } },
    },
  },
})
warehouseRoutes.openapi(inOutRoute, (c) => {
  let result = [...inOutRecords]
  const { type } = c.req.valid("query")
  if (type) result = result.filter((r) => r.type === type)
  return c.json({ data: result }, 200)
})

const locationsRoute = createRoute({
  method: "get",
  path: "/locations",
  tags: ["仓储物流"],
  summary: "获取库位列表",
  responses: {
    200: {
      description: "库位列表",
      content: { "application/json": { schema: listResponse(WarehouseLocationSchema) } },
    },
  },
})
warehouseRoutes.openapi(locationsRoute, (c) => c.json({ data: warehouseLocations }, 200))
