import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq } from "drizzle-orm"
import * as schema from "@/db/schema"

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys = ON;")
  sqlite.exec(`
    CREATE TABLE wiki_namespaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_wiki_namespaces (
      agent_id TEXT NOT NULL,
      namespace_id TEXT NOT NULL REFERENCES wiki_namespaces(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, namespace_id)
    );
  `)
  return drizzle(sqlite, { schema })
}

describe("wikiNamespaces 和 agentWikiNamespaces 核心表", () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  const now = new Date()

  it("应该能够成功插入并查询分区以及关联", async () => {
    await db.insert(schema.wikiNamespaces).values({
      id: "ns-1",
      name: "energy",
      displayName: "能源分区",
      description: "能耗相关的文档",
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(schema.agentWikiNamespaces).values({
      agentId: "energyAgent",
      namespaceId: "ns-1",
      createdAt: now,
    })

    const nss = await db.select().from(schema.wikiNamespaces)
    expect(nss).toHaveLength(1)
    expect(nss[0].name).toBe("energy")
    expect(nss[0].displayName).toBe("能源分区")

    const bindings = await db.select().from(schema.agentWikiNamespaces)
    expect(bindings).toHaveLength(1)
    expect(bindings[0].agentId).toBe("energyAgent")
    expect(bindings[0].namespaceId).toBe("ns-1")
  })

  it("分区被删除时应该能级联删除 Agent 关联记录", async () => {
    await db.insert(schema.wikiNamespaces).values({
      id: "ns-1",
      name: "energy",
      displayName: "能源分区",
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(schema.agentWikiNamespaces).values({
      agentId: "energyAgent",
      namespaceId: "ns-1",
      createdAt: now,
    })

    await db.delete(schema.wikiNamespaces).where(eq(schema.wikiNamespaces.id, "ns-1"))

    const bindings = await db.select().from(schema.agentWikiNamespaces)
    expect(bindings).toHaveLength(0)
  })

  it("联合主键约束应生效", async () => {
    await db.insert(schema.wikiNamespaces).values({
      id: "ns-1",
      name: "energy",
      displayName: "能源分区",
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(schema.agentWikiNamespaces).values({
      agentId: "energyAgent",
      namespaceId: "ns-1",
      createdAt: now,
    })

    expect(() =>
      db
        .insert(schema.agentWikiNamespaces)
        .values({
          agentId: "energyAgent",
          namespaceId: "ns-1",
          createdAt: now,
        })
        .run(),
    ).toThrow()
  })
})
