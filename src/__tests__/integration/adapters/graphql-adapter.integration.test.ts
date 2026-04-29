import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest"
import { server, mockGraphqlUrl } from "../helpers/mock-server"
import { GraphqlAdapter } from "../../../mastra/tools/datasource/adapters/graphql-adapter"
import type { DatasourceConfig } from "../../../mastra/tools/datasource/types"

// GraphQL 适配器集成测试
describe("GraphqlAdapter 集成测试", () => {
  const adapter = new GraphqlAdapter()

  // 带认证的数据源配置
  const config = {
    id: "test-gql-1",
    name: "测试GraphQL系统",
    type: "graphql",
    auth: { type: "bearer", token: "test-token" },
    config: {
      endpoint: mockGraphqlUrl,
    },
    endpoints: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DatasourceConfig

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  // 1. 成功查询 — 返回订单数据
  it("成功查询应返回订单数据", async () => {
    const result = await adapter.query(config, {
      query: "{ orders { id product } }",
    })

    expect(result.success).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as Record<string, any>
    expect(data.orders).toBeDefined()
    expect(data.orders).toHaveLength(1)
    expect(data.orders[0]).toMatchObject({ id: "O001", product: "钢材" })
  })

  // 2. GraphQL 错误 — 返回错误信息
  it("GraphQL 错误应返回失败结果", async () => {
    const result = await adapter.query(config, {
      query: "{ error }",
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("模拟错误")
  })

  // 3. testConnection 成功 — mock server 可达
  it("testConnection 成功应返回 ok:true", async () => {
    const result = await adapter.testConnection(config)

    expect(result.ok).toBe(true)
  })

  // 4. testConnection 失败 — 不可达地址
  it("testConnection 失败应返回 ok:false", async () => {
    const { http, HttpResponse } = await import("msw")

    const badConfig = {
      id: "test-gql-bad",
      name: "不可达GraphQL",
      type: "graphql",
      auth: { type: "bearer", token: "test-token" },
      config: {
        endpoint: "https://unreachable.invalid/graphql",
      },
      endpoints: [],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DatasourceConfig

    // 模拟网络错误
    server.use(
      http.post("https://unreachable.invalid/graphql", () => {
        return HttpResponse.error()
      }),
    )

    const result = await adapter.testConnection(badConfig)

    expect(result.ok).toBe(false)
  })
})
