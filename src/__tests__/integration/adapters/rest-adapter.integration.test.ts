import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest"
import { http, HttpResponse } from "msw"
import { server } from "../helpers/mock-server"
import { RestAdapter } from "../../../mastra/tools/datasource/adapters/rest-adapter"
import type { DatasourceConfig } from "../../../mastra/tools/datasource/adapters/rest-adapter"

// 基础配置：带 Bearer 认证
const baseConfig: DatasourceConfig = {
  id: "test-rest-1",
  name: "测试ERP系统",
  type: "rest",
  auth: { type: "bearer", token: "test-token" },
  config: { baseUrl: "https://mock-erp.test" },
  endpoints: [],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// 无认证配置
const noAuthConfig: DatasourceConfig = {
  ...baseConfig,
  id: "test-rest-no-auth",
  auth: { type: "none" },
}

describe("RestAdapter 集成测试", () => {
  const adapter = new RestAdapter()

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  // 1. 成功查询订单数据
  it("应成功查询并返回 mock 订单数据", async () => {
    const result = await adapter.query(baseConfig, {
      path: "/api/orders",
      method: "GET",
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      orders: [{ id: "O001", product: "钢材", quantity: 100 }],
    })
  })

  // 2. 认证失败返回 401
  it("无认证时应返回 401 错误", async () => {
    const result = await adapter.query(noAuthConfig, {
      path: "/api/orders",
      method: "GET",
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("401")
  })

  // 3. testConnection 成功
  it("testConnection 应在服务可达时返回 ok:true", async () => {
    const result = await adapter.testConnection(baseConfig)

    expect(result.ok).toBe(true)
  })

  // 4. testConnection 失败 — 不可达地址
  it("testConnection 应在服务不可达时返回 ok:false", async () => {
    const unreachableConfig: DatasourceConfig = {
      ...baseConfig,
      id: "test-rest-unreachable",
      config: { baseUrl: "https://unreachable.invalid" },
    }

    // 模拟网络错误
    server.use(
      http.head("https://unreachable.invalid", () => {
        return HttpResponse.error()
      }),
      http.head("https://unreachable.invalid/*", () => {
        return HttpResponse.error()
      }),
    )

    const result = await adapter.testConnection(unreachableConfig)

    expect(result.ok).toBe(false)
  })

  // 5. 带查询参数请求
  it("应正确传递 URL 查询参数", async () => {
    // 临时 handler：验证 query 参数并返回过滤结果
    server.use(
      http.get("https://mock-erp.test/api/orders", ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get("status")

        // 验证 Bearer token
        const auth = request.headers.get("Authorization")
        if (auth !== "Bearer test-token") {
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 验证查询参数存在
        if (status === "pending") {
          return HttpResponse.json({
            orders: [{ id: "O001", product: "钢材", quantity: 100, status: "pending" }],
          })
        }

        return HttpResponse.json({ orders: [] })
      }),
    )

    const result = await adapter.query(baseConfig, {
      path: "/api/orders",
      method: "GET",
      query: { status: "pending" },
    })

    expect(result.success).toBe(true)
    expect(result.data.orders[0].status).toBe("pending")
  })
})
