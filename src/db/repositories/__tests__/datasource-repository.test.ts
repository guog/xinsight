import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@/db/schema"
import { SqliteDatasourceRepository } from "../datasource-repository"
import type { DatasourceEndpoint } from "@/mastra/tools/datasource/types"

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE datasources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      auth TEXT NOT NULL,
      config TEXT NOT NULL,
      endpoints TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_datasources (
      agent_id TEXT NOT NULL,
      datasource_id TEXT NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, datasource_id)
    );
    PRAGMA foreign_keys = ON;
  `)
  return drizzle(sqlite, { schema })
}

const sampleEndpoints: DatasourceEndpoint[] = [
  { id: "ep1", name: "获取用户", description: "获取用户列表", params: { method: "GET", path: "/users" } },
]

const sampleInput = {
  id: "ds-1",
  name: "测试数据源",
  description: "用于测试",
  type: "rest" as const,
  auth: { type: "none" as const },
  config: { baseUrl: "https://api.example.com" },
  endpoints: sampleEndpoints,
  enabled: true,
}

describe("SqliteDatasourceRepository", () => {
  let repo: SqliteDatasourceRepository

  beforeEach(() => {
    const db = createTestDb()
    repo = new SqliteDatasourceRepository(db)
  })

  it("创建并读取数据源 (with endpoints)", async () => {
    const created = await repo.create(sampleInput)
    expect(created.id).toBe("ds-1")
    expect(created.name).toBe("测试数据源")
    expect(created.endpoints).toEqual(sampleEndpoints)
    expect(created.enabled).toBe(true)

    const found = await repo.findById("ds-1")
    expect(found).not.toBeNull()
    expect(found!.endpoints).toEqual(sampleEndpoints)
  })

  it("列出所有数据源 / 只列出启用的", async () => {
    await repo.create(sampleInput)
    await repo.create({ ...sampleInput, id: "ds-2", name: "禁用源", enabled: false })

    const all = await repo.findAll()
    expect(all).toHaveLength(2)

    const enabled = await repo.findAllEnabled()
    expect(enabled).toHaveLength(1)
    expect(enabled[0].id).toBe("ds-1")
  })

  it("更新数据源 (including endpoints update)", async () => {
    await repo.create(sampleInput)
    const newEndpoints: DatasourceEndpoint[] = [
      { id: "ep2", name: "新接口", description: "更新后", params: { method: "POST" } },
    ]
    const updated = await repo.update("ds-1", { name: "新名称", endpoints: newEndpoints })
    expect(updated.name).toBe("新名称")
    expect(updated.endpoints).toEqual(newEndpoints)
  })

  it("删除数据源", async () => {
    await repo.create(sampleInput)
    await repo.delete("ds-1")
    const found = await repo.findById("ds-1")
    expect(found).toBeNull()
  })

  it("Agent 绑定/解绑", async () => {
    await repo.create(sampleInput)
    await repo.bindAgent("agent-1", "ds-1")

    let bindings = await repo.getAgentBindings("agent-1")
    expect(bindings).toEqual(["ds-1"])

    await repo.unbindAgent("agent-1", "ds-1")
    bindings = await repo.getAgentBindings("agent-1")
    expect(bindings).toEqual([])
  })

  it("findByAgentId 只返回绑定且启用的数据源", async () => {
    await repo.create(sampleInput)
    await repo.create({ ...sampleInput, id: "ds-2", name: "禁用源", enabled: false })
    await repo.bindAgent("agent-1", "ds-1")
    await repo.bindAgent("agent-1", "ds-2")

    const result = await repo.findByAgentId("agent-1")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("ds-1")
  })

  it("getDatasourceAgents 返回绑定的 agent IDs", async () => {
    await repo.create(sampleInput)
    await repo.bindAgent("agent-1", "ds-1")
    await repo.bindAgent("agent-2", "ds-1")

    const agents = await repo.getDatasourceAgents("ds-1")
    expect(agents.sort()).toEqual(["agent-1", "agent-2"])
  })
})
