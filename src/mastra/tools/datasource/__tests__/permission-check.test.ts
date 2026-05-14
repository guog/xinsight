import { describe, it, expect, vi } from "vitest"

// mock 数据库层，避免真实数据库连接
vi.mock("@/db", () => ({
  db: {},
}))

vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: class {
    findById = vi.fn().mockResolvedValue({
      id: "ds-1",
      name: "测试数据源",
      enabled: true,
      type: "http",
      baseUrl: "http://example.com",
      endpoints: [],
    })
    getAgentEndpointBindings = vi.fn()
  },
}))

describe("datasourceQueryTool 权限检查 — agentId 为空", () => {
  it("agentId 为空时应返回错误而非跳过权限检查", async () => {
    const { datasourceQueryTool } = await import("../index")

    const result = await (datasourceQueryTool as any).execute(
      { datasourceId: "ds-1", params: {} },
      {} as any,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("缺少 Agent 上下文")
  })
})
