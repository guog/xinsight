import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "@/db/schema"
import { SqliteAgentRepository } from "../agent-repository"

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE custom_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL DEFAULT '',
      model_id TEXT,
      icon TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE datasources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      auth TEXT NOT NULL,
      config TEXT NOT NULL,
      endpoints TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_tested_at INTEGER,
      last_test_result TEXT,
      last_test_message TEXT,
      last_called_at INTEGER,
      call_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_datasources (
      agent_id TEXT NOT NULL,
      datasource_id TEXT NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
      endpoint_ids TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, datasource_id)
    );
    PRAGMA foreign_keys = ON;
  `)
  return drizzle(sqlite, { schema })
}

describe("SqliteAgentRepository", () => {
  let db: ReturnType<typeof createTestDb>
  let repo: SqliteAgentRepository

  beforeEach(() => {
    db = createTestDb()
    repo = new SqliteAgentRepository(db)
  })

  describe("create", () => {
    it("应创建自定义 Agent", async () => {
      const agent = await repo.create({
        id: "test-agent",
        name: "测试 Agent",
        description: "用于测试",
        systemPrompt: "你是一个测试助手",
        icon: "🧪",
      })

      expect(agent.id).toBe("test-agent")
      expect(agent.name).toBe("测试 Agent")
      expect(agent.description).toBe("用于测试")
      expect(agent.systemPrompt).toBe("你是一个测试助手")
      expect(agent.icon).toBe("🧪")
      expect(agent.isBuiltin).toBe(false)
      expect(agent.enabled).toBe(true)
      expect(agent.createdAt).toBeInstanceOf(Date)
    })

    it("应创建内置 Agent", async () => {
      const agent = await repo.create({
        id: "chatAgent",
        name: "通用对话",
        isBuiltin: true,
      })

      expect(agent.isBuiltin).toBe(true)
    })
  })

  describe("findById", () => {
    it("应找到已存在的 Agent", async () => {
      await repo.create({ id: "a1", name: "Agent 1" })
      const found = await repo.findById("a1")
      expect(found).not.toBeNull()
      expect(found!.name).toBe("Agent 1")
    })

    it("不存在时返回 null", async () => {
      const found = await repo.findById("nonexistent")
      expect(found).toBeNull()
    })
  })

  describe("findAll", () => {
    it("应返回所有 Agent", async () => {
      await repo.create({ id: "a1", name: "Agent 1" })
      await repo.create({ id: "a2", name: "Agent 2", isBuiltin: true })

      const all = await repo.findAll()
      expect(all).toHaveLength(2)
    })
  })

  describe("findEnabled", () => {
    it("应仅返回启用的 Agent", async () => {
      await repo.create({ id: "a1", name: "Agent 1", enabled: true })
      await repo.create({ id: "a2", name: "Agent 2", enabled: false })

      const enabled = await repo.findEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].id).toBe("a1")
    })
  })

  describe("update", () => {
    it("应更新自定义 Agent", async () => {
      await repo.create({ id: "a1", name: "旧名称" })
      const updated = await repo.update("a1", { name: "新名称" })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe("新名称")
    })

    it("不可修改内置 Agent", async () => {
      await repo.create({ id: "builtin1", name: "内置", isBuiltin: true })

      await expect(repo.update("builtin1", { name: "新名称" })).rejects.toThrow(
        "内置 Agent 不可修改",
      )
    })

    it("不存在时返回 null", async () => {
      const result = await repo.update("nonexistent", { name: "x" })
      expect(result).toBeNull()
    })
  })

  describe("delete", () => {
    it("应删除自定义 Agent", async () => {
      await repo.create({ id: "a1", name: "Agent 1" })
      const deleted = await repo.delete("a1")
      expect(deleted).toBe(true)

      const found = await repo.findById("a1")
      expect(found).toBeNull()
    })

    it("不可删除内置 Agent", async () => {
      await repo.create({ id: "builtin1", name: "内置", isBuiltin: true })
      await expect(repo.delete("builtin1")).rejects.toThrow("内置 Agent 不可删除")
    })

    it("不存在时返回 false", async () => {
      const result = await repo.delete("nonexistent")
      expect(result).toBe(false)
    })
  })
})
