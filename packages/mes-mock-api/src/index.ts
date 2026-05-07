import { OpenAPIHono } from "@hono/zod-openapi"
import { swaggerUI } from "@hono/swagger-ui"
import { cors } from "hono/cors"
import {
  baseRoutes,
  productionRoutes,
  qualityRoutes,
  equipmentRoutes,
  warehouseRoutes,
  energyRoutes,
  traceabilityRoutes,
} from "./routes"

const app = new OpenAPIHono()

// CORS
app.use("/*", cors())

// 健康检查
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }))

// 挂载路由
app.route("/api/base", baseRoutes)
app.route("/api/production", productionRoutes)
app.route("/api/quality", qualityRoutes)
app.route("/api/equipment", equipmentRoutes)
app.route("/api/warehouse", warehouseRoutes)
app.route("/api/energy", energyRoutes)
app.route("/api/traceability", traceabilityRoutes)

// OpenAPI 文档
app.doc("/api/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "MES Mock API",
    version: "0.1.0",
    description: "模拟 MES 制造执行系统 REST API",
  },
})

// Swagger UI
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }))

export default {
  port: 3001,
  fetch: app.fetch,
}
