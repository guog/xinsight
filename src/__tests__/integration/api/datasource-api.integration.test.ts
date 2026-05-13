/**
 * 数据源 API 集成测试
 * 通过 Repository CRUD 完整链路验证 API 层核心业务逻辑
 */
import { describe, it, expect } from "vitest"
import { createTestDb } from "../helpers/test-db"
import type { CreateDatasourceInput } from "../../../db/repositories/datasource-repository"

function makeInput(overrides?: Partial<CreateDatasourceInput>): CreateDatasourceInput {
  return {
    id: "ds-test-1",
    name: "测试MES系统",
    type: "rest",
    auth: { type: "bearer", token: "xxx" },
    config: { baseUrl: "https://mes.test" },
    endpoints: [
      {
        id: "e1",
        name: "订单列表",
        description: "获取订单",
        params: { path: "/orders", method: "GET" },
        apiSchemaFormat: "natural" as const,
      },
    ],
    ...overrides,
  }
}

describe("数据源 API 集成测试", () => {
  it("POST 语义：repo.create() 成功创建数据源，返回完整记录", async () => {
    const { repo } = createTestDb()
    const input = makeInput()
    const record = await repo.create(input)

    expect(record.id).toBe("ds-test-1")
    expect(record.name).toBe("测试MES系统")
    expect(record.type).toBe("rest")
    expect(record.auth).toEqual({ type: "bearer", token: "xxx" })
    expect(record.config).toEqual({ baseUrl: "https://mes.test" })
    expect(record.endpoints).toHaveLength(1)
    expect(record.endpoints[0].name).toBe("订单列表")
    expect(record.createdAt).toBeInstanceOf(Date)
    expect(record.updatedAt).toBeInstanceOf(Date)
  })

  it("GET all 语义：repo.findAll() 返回所有数据源", async () => {
    const { repo } = createTestDb()
    await repo.create(makeInput({ id: "ds-1", name: "数据源1" }))
    await repo.create(makeInput({ id: "ds-2", name: "数据源2" }))

    const all = await repo.findAll()
    expect(all).toHaveLength(2)
    expect(all.map((d) => d.id)).toEqual(expect.arrayContaining(["ds-1", "ds-2"]))
  })

  it("GET by id 语义：repo.findById() 返回单个数据源", async () => {
    const { repo } = createTestDb()
    await repo.create(makeInput())

    const found = await repo.findById("ds-test-1")
    expect(found).not.toBeNull()
    expect(found!.name).toBe("测试MES系统")
  })

  it("GET by id 不存在：repo.findById() 返回 null", async () => {
    const { repo } = createTestDb()

    const found = await repo.findById("non-exist")
    expect(found).toBeNull()
  })

  it("PUT 语义：repo.update() 更新后返回新值", async () => {
    const { repo } = createTestDb()
    await repo.create(makeInput())

    const updated = await repo.update("ds-test-1", { name: "更新后的名称" })
    expect(updated.name).toBe("更新后的名称")
    expect(updated.type).toBe("rest") // 未更新的字段保持不变
  })

  it("DELETE 语义：repo.delete() 后 findById 返回 null", async () => {
    const { repo } = createTestDb()
    await repo.create(makeInput())

    await repo.delete("ds-test-1")
    const found = await repo.findById("ds-test-1")
    expect(found).toBeNull()
  })

  it("Agent 绑定完整流程：bindAgent → getDatasourceAgents → unbindAgent", async () => {
    const { repo } = createTestDb()
    await repo.create(makeInput())

    // 绑定
    await repo.bindAgent("agent-1", "ds-test-1")
    const agents = await repo.getDatasourceAgents("ds-test-1")
    expect(agents).toEqual(["agent-1"])

    // 解绑
    await repo.unbindAgent("agent-1", "ds-test-1")
    const agentsAfter = await repo.getDatasourceAgents("ds-test-1")
    expect(agentsAfter).toEqual([])
  })

  it("findByAgentId 只返回 enabled 的数据源", async () => {
    const { repo } = createTestDb()
    await repo.create(makeInput({ id: "ds-enabled", enabled: true }))
    await repo.create(makeInput({ id: "ds-disabled", name: "已禁用", enabled: false }))

    await repo.bindAgent("agent-1", "ds-enabled")
    await repo.bindAgent("agent-1", "ds-disabled")

    const results = await repo.findByAgentId("agent-1")
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("ds-enabled")
  })
})
