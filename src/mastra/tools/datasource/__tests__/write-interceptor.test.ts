import { describe, test, expect, mock } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "@/db/schema"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"

const sqlite = new Database(":memory:")
sqlite.exec(`
  CREATE TABLE datasources (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT, type TEXT NOT NULL,
    auth TEXT NOT NULL, config TEXT NOT NULL, endpoints TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1, last_tested_at INTEGER, last_test_result TEXT,
    last_test_message TEXT, last_called_at INTEGER, call_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE agent_datasources (
    agent_id TEXT NOT NULL, datasource_id TEXT NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
    endpoint_ids TEXT,
    confirmation_required_endpoints TEXT,
    created_at INTEGER NOT NULL, PRIMARY KEY (agent_id, datasource_id)
  );
`)
const testDb = drizzle(sqlite, { schema })

mock.module("@/db", () => {
  return {
    db: testDb,
  }
})

// 延迟导入 buildDynamicTools，以便它使用 Mock 后的 testDb
import { buildDynamicTools } from "../build-dynamic-tools"

const mockQueryFn = mock(() =>
  Promise.resolve({
    success: true,
    data: { ok: true },
  }),
)

mock.module("../adapters", () => {
  return {
    getAdapter: () => ({
      type: "rest",
      query: mockQueryFn,
      testConnection: () => Promise.resolve({ ok: true, message: "connected" }),
    }),
  }
})

describe("写操作安全确认拦截单元测试", () => {
  test("写操作被配置了二次确认时，执行 Tool 将返回 CONFIRMATION_REQUIRED", async () => {
    const repo = new SqliteDatasourceRepository(testDb)

    const endpoints = [
      {
        id: "create-user",
        name: "Create User",
        path: "/users",
        method: "POST",
        description: "创建用户",
        structuredParams: [{ name: "name", type: "string", required: true }],
      },
      {
        id: "get-user",
        name: "Get User",
        path: "/users/{id}",
        method: "GET",
        description: "获取用户",
        structuredParams: [{ name: "id", type: "string", required: true }],
      },
    ]

    const ds = await repo.create({
      id: "ds-write-test",
      name: "Test Write DS",
      type: "rest",
      auth: { type: "none" },
      config: { baseUrl: "https://api.example.com" },
      endpoints: endpoints as any,
    })

    await repo.bindAgent(
      "test-agent",
      ds.id,
      ["create-user", "get-user"],
      ["create-user"], // 二次确认列表
    )

    // 构建动态工具集
    const tools = await buildDynamicTools("test-agent")

    // 验证是否注册了这两个工具
    expect(tools["ds-write-test--create-user"]).toBeDefined()
    expect(tools["ds-write-test--get-user"]).toBeDefined()

    // 1. 调用需要二次确认的 POST 端点工具，验证拦截
    const writeResult = await tools["ds-write-test--create-user"].execute({
      params: { name: "Alice" },
    })

    expect(writeResult.success).toBe(false)
    expect(writeResult.error).toBe("CONFIRMATION_REQUIRED")
    expect(writeResult.metadata?.confirmationRequired).toBe(true)
    expect(writeResult.metadata?.datasourceId).toBe("ds-write-test")
    expect(writeResult.metadata?.endpointId).toBe("create-user")
    expect(writeResult.metadata?.params).toEqual({ name: "Alice" })

    // 确保底层的适配器查询方法没有被触发（安全硬拦截）
    expect(mockQueryFn).not.toHaveBeenCalled()

    // 2. 调用不需要二次确认的 GET 端点工具，验证放行
    const readResult = await tools["ds-write-test--get-user"].execute({
      params: { id: "123" },
    })

    expect(readResult.success).toBe(true)
    expect(mockQueryFn).toHaveBeenCalled()
  })
})
