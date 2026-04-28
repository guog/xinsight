# 数据源适配器系统 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让每个 Agent（数字人）能通过统一接口实时抓取第三方工业系统（MES/ERP 等）的数据，支持 REST、GraphQL、gRPC、OPC UA、MQTT 等协议。

**Architecture:** 适配器模式 — 统一的 `DatasourceAdapter` 接口 + 每种协议一个实现。数据源配置存 DB（Drizzle ORM + SQLite，Repository 抽象层方便后续切 PG）。Agent 通过 Mastra Tool 调用统一入口，不直连数据库。

**Tech Stack:** Drizzle ORM, better-sqlite3, Zod, Mastra Tools, Vitest

---

## Phase 1: 基础设施 — 数据库 + 类型 + Repository

### Task 1: 安装 Drizzle ORM + SQLite 依赖

**Objective:** 引入数据库基础设施

**Step 1: 安装依赖**

```bash
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3
```

**Step 2: 创建 Drizzle 配置**

创建: `drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/xinsight.db",
  },
})
```

**Step 3: 创建数据库连接**

创建: `src/db/index.ts`

```typescript
import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as schema from "./schema"

const sqlite = new Database(process.env.DATABASE_URL ?? "./data/xinsight.db")
export const db = drizzle(sqlite, { schema })
export type DB = typeof db
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: 添加 Drizzle ORM + SQLite 基础设施"
```

---

### Task 2: 定义数据源配置类型和数据库 Schema

**Objective:** 定义数据源的类型系统和数据库表结构

**Files:**

- Create: `src/mastra/tools/datasource/types.ts`
- Create: `src/db/schema.ts`

**Step 1: 写类型定义**

创建: `src/mastra/tools/datasource/types.ts`

```typescript
import { z } from "zod"

/** 支持的适配器协议类型 */
export const AdapterType = z.enum(["rest", "graphql", "grpc", "opcua", "mqtt"])
export type AdapterType = z.infer<typeof AdapterType>

/** 认证配置 */
export const AuthConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("bearer"), token: z.string() }),
  z.object({ type: z.literal("basic"), username: z.string(), password: z.string() }),
  z.object({
    type: z.literal("apikey"),
    key: z.string(),
    value: z.string(),
    in: z.enum(["header", "query"]),
  }),
])
export type AuthConfig = z.infer<typeof AuthConfigSchema>

/** REST 适配器配置 */
export const RestConfigSchema = z.object({
  baseUrl: z.string().url(),
  defaultHeaders: z.record(z.string()).optional(),
  timeout: z.number().positive().default(30000),
})

/** GraphQL 适配器配置 */
export const GraphqlConfigSchema = z.object({
  endpoint: z.string().url(),
  defaultHeaders: z.record(z.string()).optional(),
  timeout: z.number().positive().default(30000),
})

/** 数据源配置（完整） */
export const DatasourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: AdapterType,
  auth: AuthConfigSchema,
  config: z.record(z.unknown()), // 各协议的具体配置，JSON 存储
  enabled: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type DatasourceConfig = z.infer<typeof DatasourceConfigSchema>

/** 查询请求 */
export interface DatasourceQuery {
  datasourceId: string
  /** REST: path + method + body; GraphQL: query + variables; etc. */
  params: Record<string, unknown>
}

/** 查询响应 */
export interface DatasourceResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    duration: number
    datasourceId: string
    datasourceName: string
  }
}

/** 适配器接口 — 所有协议必须实现 */
export interface DatasourceAdapter {
  readonly type: AdapterType
  query(config: DatasourceConfig, params: Record<string, unknown>): Promise<DatasourceResult>
  testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }>
}
```

**Step 2: 写数据库 Schema**

创建: `src/db/schema.ts`

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const datasources = sqliteTable("datasources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "rest" | "graphql" | "grpc" | "opcua" | "mqtt"
  auth: text("auth").notNull(), // JSON string
  config: text("config").notNull(), // JSON string — 协议特定配置
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

/** Agent 与数据源的多对多关联表 */
export const agentDatasources = sqliteTable(
  "agent_datasources",
  {
    agentId: text("agent_id").notNull(), // Mastra Agent ID，如 "chat-agent"
    datasourceId: text("datasource_id")
      .notNull()
      .references(() => datasources.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.agentId, table.datasourceId] }),
  }),
)
```

**Step 3: 生成迁移并应用**

```bash
bunx drizzle-kit generate
bunx drizzle-kit push
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 定义数据源类型系统和数据库 schema"
```

---

### Task 3: 实现 DatasourceRepository 抽象 + SQLite 实现

**Objective:** Repository 模式封装数据源 CRUD，方便后续切换数据库

**Files:**

- Create: `src/db/repositories/datasource-repository.ts`
- Create: `src/db/repositories/__tests__/datasource-repository.test.ts`

**Step 1: 写失败测试**

创建: `src/db/repositories/__tests__/datasource-repository.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { SQLiteDatasourceRepository } from "../datasource-repository"
import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as schema from "../../schema"

function createTestDb() {
  const sqlite = new Database(":memory:")
  const db = drizzle(sqlite, { schema })
  // 手动建表（测试用内存库）
  sqlite.exec(`
    CREATE TABLE datasources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      auth TEXT NOT NULL,
      config TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  return db
}

describe("SQLiteDatasourceRepository", () => {
  let repo: SQLiteDatasourceRepository

  beforeEach(() => {
    const db = createTestDb()
    repo = new SQLiteDatasourceRepository(db)
  })

  it("创建并读取数据源", async () => {
    const ds = await repo.create({
      id: "mes-1",
      name: "MES 生产系统",
      type: "rest",
      auth: { type: "bearer", token: "xxx" },
      config: { baseUrl: "https://mes.example.com/api" },
      enabled: true,
    })

    expect(ds.id).toBe("mes-1")
    expect(ds.name).toBe("MES 生产系统")

    const found = await repo.findById("mes-1")
    expect(found).not.toBeNull()
    expect(found!.name).toBe("MES 生产系统")
    expect(found!.auth).toEqual({ type: "bearer", token: "xxx" })
  })

  it("列出所有数据源", async () => {
    await repo.create({
      id: "a",
      name: "A",
      type: "rest",
      auth: { type: "none" },
      config: {},
      enabled: true,
    })
    await repo.create({
      id: "b",
      name: "B",
      type: "graphql",
      auth: { type: "none" },
      config: {},
      enabled: false,
    })

    const all = await repo.findAll()
    expect(all).toHaveLength(2)

    const enabled = await repo.findAllEnabled()
    expect(enabled).toHaveLength(1)
    expect(enabled[0].id).toBe("a")
  })

  it("更新数据源", async () => {
    await repo.create({
      id: "x",
      name: "Old",
      type: "rest",
      auth: { type: "none" },
      config: {},
      enabled: true,
    })
    await repo.update("x", { name: "New", enabled: false })

    const updated = await repo.findById("x")
    expect(updated!.name).toBe("New")
    expect(updated!.enabled).toBe(false)
  })

  it("删除数据源", async () => {
    await repo.create({
      id: "del",
      name: "Temp",
      type: "rest",
      auth: { type: "none" },
      config: {},
      enabled: true,
    })
    await repo.delete("del")

    const gone = await repo.findById("del")
    expect(gone).toBeNull()
  })
})
```

**Step 2: 运行测试验证失败**

```bash
bun run test src/db/repositories/__tests__/datasource-repository.test.ts
```

Expected: FAIL — module not found

**Step 3: 实现 Repository**

创建: `src/db/repositories/datasource-repository.ts`

```typescript
import { eq } from "drizzle-orm"
import { datasources } from "../schema"
import type { DB } from "../index"
import type { AuthConfig } from "../../mastra/tools/datasource/types"

/** 创建数据源的入参 */
export interface CreateDatasourceInput {
  id: string
  name: string
  description?: string
  type: string
  auth: AuthConfig
  config: Record<string, unknown>
  enabled: boolean
}

/** 更新数据源的入参（所有字段可选） */
export interface UpdateDatasourceInput {
  name?: string
  description?: string
  type?: string
  auth?: AuthConfig
  config?: Record<string, unknown>
  enabled?: boolean
}

/** 数据源记录 */
export interface DatasourceRecord {
  id: string
  name: string
  description: string | null
  type: string
  auth: AuthConfig
  config: Record<string, unknown>
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/** 抽象接口 — 切换数据库只需新实现 */
export interface DatasourceRepository {
  create(input: CreateDatasourceInput): Promise<DatasourceRecord>
  findById(id: string): Promise<DatasourceRecord | null>
  findAll(): Promise<DatasourceRecord[]>
  findAllEnabled(): Promise<DatasourceRecord[]>
  findByAgentId(agentId: string): Promise<DatasourceRecord[]>
  update(id: string, input: UpdateDatasourceInput): Promise<DatasourceRecord>
  delete(id: string): Promise<void>
  // Agent 关联
  bindAgent(agentId: string, datasourceId: string): Promise<void>
  unbindAgent(agentId: string, datasourceId: string): Promise<void>
  getAgentBindings(agentId: string): Promise<string[]>
  getDatasourceAgents(datasourceId: string): Promise<string[]>
}

/** SQLite 实现 */
export class SQLiteDatasourceRepository implements DatasourceRepository {
  constructor(private db: DB) {}

  async create(input: CreateDatasourceInput): Promise<DatasourceRecord> {
    const now = new Date()
    const row = {
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      auth: JSON.stringify(input.auth),
      config: JSON.stringify(input.config),
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.insert(datasources).values(row)
    return this.deserialize({ ...row, createdAt: now, updatedAt: now })
  }

  async findById(id: string): Promise<DatasourceRecord | null> {
    const rows = await this.db.select().from(datasources).where(eq(datasources.id, id))
    if (rows.length === 0) return null
    return this.deserialize(rows[0])
  }

  async findAll(): Promise<DatasourceRecord[]> {
    const rows = await this.db.select().from(datasources)
    return rows.map((r) => this.deserialize(r))
  }

  async findAllEnabled(): Promise<DatasourceRecord[]> {
    const rows = await this.db.select().from(datasources).where(eq(datasources.enabled, true))
    return rows.map((r) => this.deserialize(r))
  }

  async update(id: string, input: UpdateDatasourceInput): Promise<DatasourceRecord> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) updates.name = input.name
    if (input.description !== undefined) updates.description = input.description
    if (input.type !== undefined) updates.type = input.type
    if (input.auth !== undefined) updates.auth = JSON.stringify(input.auth)
    if (input.config !== undefined) updates.config = JSON.stringify(input.config)
    if (input.enabled !== undefined) updates.enabled = input.enabled

    await this.db.update(datasources).set(updates).where(eq(datasources.id, id))
    return (await this.findById(id))!
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(datasources).where(eq(datasources.id, id))
  }

  private deserialize(row: typeof datasources.$inferSelect): DatasourceRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      auth: JSON.parse(row.auth) as AuthConfig,
      config: JSON.parse(row.config) as Record<string, unknown>,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
```

**Step 4: 运行测试验证通过**

```bash
bun run test src/db/repositories/__tests__/datasource-repository.test.ts
```

Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: 实现 DatasourceRepository 抽象及 SQLite 实现"
```

---

## Phase 2: 适配器实现

### Task 4: 实现 REST Adapter

**Objective:** 实现 REST API 数据源适配器，支持 GET/POST + 认证

**Files:**

- Create: `src/mastra/tools/datasource/adapters/rest-adapter.ts`
- Create: `src/mastra/tools/datasource/adapters/__tests__/rest-adapter.test.ts`
- Create: `src/mastra/tools/datasource/adapters/index.ts`

**Step 1: 写失败测试**

创建: `src/mastra/tools/datasource/adapters/__tests__/rest-adapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { RestAdapter } from "../rest-adapter"
import type { DatasourceConfig } from "../../types"

// mock fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const baseConfig: DatasourceConfig = {
  id: "test-rest",
  name: "Test REST",
  type: "rest",
  auth: { type: "none" },
  config: { baseUrl: "https://api.example.com", timeout: 5000 },
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("RestAdapter", () => {
  let adapter: RestAdapter

  beforeEach(() => {
    adapter = new RestAdapter()
    mockFetch.mockReset()
  })

  it("type 为 rest", () => {
    expect(adapter.type).toBe("rest")
  })

  it("GET 请求", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [1, 2, 3] }),
    })

    const result = await adapter.query(baseConfig, {
      path: "/orders",
      method: "GET",
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ items: [1, 2, 3] })
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/orders",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("POST 请求带 body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new-1" }),
    })

    const result = await adapter.query(baseConfig, {
      path: "/orders",
      method: "POST",
      body: { product: "widget", qty: 10 },
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: "new-1" })
  })

  it("Bearer 认证注入 header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const config = {
      ...baseConfig,
      auth: { type: "bearer" as const, token: "my-token" },
    }

    await adapter.query(config, { path: "/data", method: "GET" })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers.get("Authorization")).toBe("Bearer my-token")
  })

  it("HTTP 错误返回 success=false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    })

    const result = await adapter.query(baseConfig, { path: "/fail", method: "GET" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("500")
  })

  it("testConnection 成功", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    const result = await adapter.testConnection(baseConfig)
    expect(result.ok).toBe(true)
  })
})
```

**Step 2: 运行测试验证失败**

```bash
bun run test src/mastra/tools/datasource/adapters/__tests__/rest-adapter.test.ts
```

**Step 3: 实现 REST Adapter**

创建: `src/mastra/tools/datasource/adapters/rest-adapter.ts`

```typescript
import type { DatasourceAdapter, DatasourceConfig, DatasourceResult } from "../types"

export class RestAdapter implements DatasourceAdapter {
  readonly type = "rest" as const

  async query(
    config: DatasourceConfig,
    params: Record<string, unknown>,
  ): Promise<DatasourceResult> {
    const start = Date.now()
    const { baseUrl, timeout = 30000 } = config.config as { baseUrl: string; timeout?: number }
    const {
      path = "",
      method = "GET",
      body,
      headers: extraHeaders,
      query: queryParams,
    } = params as {
      path?: string
      method?: string
      body?: unknown
      headers?: Record<string, string>
      query?: Record<string, string>
    }

    let url = `${baseUrl.replace(/\/$/, "")}${path}`
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString()
      url += `?${qs}`
    }

    const headers = this.buildHeaders(config, extraHeaders)
    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout),
    }
    if (body && method !== "GET") {
      fetchOpts.body = JSON.stringify(body)
      headers.set("Content-Type", "application/json")
    }

    try {
      const res = await fetch(url, fetchOpts)
      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status} ${res.statusText}`,
          metadata: {
            duration: Date.now() - start,
            datasourceId: config.id,
            datasourceName: config.name,
          },
        }
      }
      const data = await res.json()
      return {
        success: true,
        data,
        metadata: {
          duration: Date.now() - start,
          datasourceId: config.id,
          datasourceName: config.name,
        },
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: {
          duration: Date.now() - start,
          datasourceId: config.id,
          datasourceName: config.name,
        },
      }
    }
  }

  async testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const { baseUrl } = config.config as { baseUrl: string }
      const headers = this.buildHeaders(config)
      const res = await fetch(baseUrl, {
        method: "HEAD",
        headers,
        signal: AbortSignal.timeout(10000),
      })
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  private buildHeaders(config: DatasourceConfig, extra?: Record<string, string>): Headers {
    const headers = new Headers()
    const { defaultHeaders } = config.config as { defaultHeaders?: Record<string, string> }
    if (defaultHeaders) {
      for (const [k, v] of Object.entries(defaultHeaders)) headers.set(k, v)
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) headers.set(k, v)
    }

    // 注入认证
    switch (config.auth.type) {
      case "bearer":
        headers.set("Authorization", `Bearer ${config.auth.token}`)
        break
      case "basic": {
        const encoded = btoa(`${config.auth.username}:${config.auth.password}`)
        headers.set("Authorization", `Basic ${encoded}`)
        break
      }
      case "apikey":
        if (config.auth.in === "header") {
          headers.set(config.auth.key, config.auth.value)
        }
        break
    }

    return headers
  }
}
```

**Step 4: 创建适配器索引 + 注册表**

创建: `src/mastra/tools/datasource/adapters/index.ts`

```typescript
import type { DatasourceAdapter, AdapterType } from "../types"
import { RestAdapter } from "./rest-adapter"

const adapters = new Map<string, DatasourceAdapter>()

/** 注册适配器 */
export function registerAdapter(adapter: DatasourceAdapter): void {
  adapters.set(adapter.type, adapter)
}

/** 获取适配器 */
export function getAdapter(type: string): DatasourceAdapter | undefined {
  return adapters.get(type)
}

// 默认注册
registerAdapter(new RestAdapter())
```

**Step 5: 运行测试验证通过**

```bash
bun run test src/mastra/tools/datasource/adapters/__tests__/rest-adapter.test.ts
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: 实现 REST 数据源适配器"
```

---

### Task 5: 实现 GraphQL Adapter

**Objective:** 实现 GraphQL 数据源适配器

**Files:**

- Create: `src/mastra/tools/datasource/adapters/graphql-adapter.ts`
- Create: `src/mastra/tools/datasource/adapters/__tests__/graphql-adapter.test.ts`

**Step 1: 写失败测试**

创建: `src/mastra/tools/datasource/adapters/__tests__/graphql-adapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GraphqlAdapter } from "../graphql-adapter"
import type { DatasourceConfig } from "../../types"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const baseConfig: DatasourceConfig = {
  id: "test-gql",
  name: "Test GraphQL",
  type: "graphql",
  auth: { type: "none" },
  config: { endpoint: "https://api.example.com/graphql", timeout: 5000 },
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("GraphqlAdapter", () => {
  let adapter: GraphqlAdapter

  beforeEach(() => {
    adapter = new GraphqlAdapter()
    mockFetch.mockReset()
  })

  it("type 为 graphql", () => {
    expect(adapter.type).toBe("graphql")
  })

  it("发送 GraphQL query", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { orders: [{ id: "1" }] } }),
    })

    const result = await adapter.query(baseConfig, {
      query: "query { orders { id } }",
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ orders: [{ id: "1" }] })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://api.example.com/graphql")
    const body = JSON.parse(opts.body)
    expect(body.query).toBe("query { orders { id } }")
  })

  it("带 variables 的查询", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { order: { id: "42" } } }),
    })

    await adapter.query(baseConfig, {
      query: "query($id: ID!) { order(id: $id) { id } }",
      variables: { id: "42" },
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.variables).toEqual({ id: "42" })
  })

  it("GraphQL errors 返回 success=false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: "Field not found" }] }),
    })

    const result = await adapter.query(baseConfig, { query: "{ bad }" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("Field not found")
  })
})
```

**Step 2-4: 实现 → 测试通过**

创建: `src/mastra/tools/datasource/adapters/graphql-adapter.ts`

```typescript
import type { DatasourceAdapter, DatasourceConfig, DatasourceResult } from "../types"

export class GraphqlAdapter implements DatasourceAdapter {
  readonly type = "graphql" as const

  async query(
    config: DatasourceConfig,
    params: Record<string, unknown>,
  ): Promise<DatasourceResult> {
    const start = Date.now()
    const { endpoint, timeout = 30000 } = config.config as { endpoint: string; timeout?: number }
    const { query, variables, operationName } = params as {
      query: string
      variables?: Record<string, unknown>
      operationName?: string
    }

    const headers = new Headers({ "Content-Type": "application/json" })
    this.applyAuth(config, headers)

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables, operationName }),
        signal: AbortSignal.timeout(timeout),
      })

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status} ${res.statusText}`,
          metadata: {
            duration: Date.now() - start,
            datasourceId: config.id,
            datasourceName: config.name,
          },
        }
      }

      const json = await res.json()
      if (json.errors?.length) {
        return {
          success: false,
          error: json.errors.map((e: { message: string }) => e.message).join("; "),
          metadata: {
            duration: Date.now() - start,
            datasourceId: config.id,
            datasourceName: config.name,
          },
        }
      }

      return {
        success: true,
        data: json.data,
        metadata: {
          duration: Date.now() - start,
          datasourceId: config.id,
          datasourceName: config.name,
        },
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: {
          duration: Date.now() - start,
          datasourceId: config.id,
          datasourceName: config.name,
        },
      }
    }
  }

  async testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }> {
    const result = await this.query(config, { query: "{ __typename }" })
    return {
      ok: result.success,
      message: result.success ? "连接成功" : (result.error ?? "未知错误"),
    }
  }

  private applyAuth(config: DatasourceConfig, headers: Headers): void {
    switch (config.auth.type) {
      case "bearer":
        headers.set("Authorization", `Bearer ${config.auth.token}`)
        break
      case "basic": {
        const encoded = btoa(`${config.auth.username}:${config.auth.password}`)
        headers.set("Authorization", `Basic ${encoded}`)
        break
      }
      case "apikey":
        if (config.auth.in === "header") headers.set(config.auth.key, config.auth.value)
        break
    }
  }
}
```

在 `adapters/index.ts` 中追加注册：

```typescript
import { GraphqlAdapter } from "./graphql-adapter"
registerAdapter(new GraphqlAdapter())
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: 实现 GraphQL 数据源适配器"
```

---

## Phase 3: Mastra Tool 集成

### Task 6: 创建 datasource-query Mastra Tool

**Objective:** 创建统一的 Mastra Tool，让 Agent 能查询任意已注册数据源

**Files:**

- Create: `src/mastra/tools/datasource/index.ts`
- Create: `src/mastra/tools/datasource/__tests__/datasource-tool.test.ts`
- Modify: `src/mastra/index.ts` — 把 Tool 挂到 Agent

**Step 1: 写失败测试**

创建: `src/mastra/tools/datasource/__tests__/datasource-tool.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import { datasourceQueryTool } from "../index"

describe("datasource-query Tool", () => {
  it("Tool 定义完整", () => {
    expect(datasourceQueryTool.id).toBe("datasource-query")
    expect(datasourceQueryTool.description).toContain("数据源")
    expect(datasourceQueryTool.inputSchema).toBeDefined()
    expect(datasourceQueryTool.outputSchema).toBeDefined()
  })
})
```

**Step 2: 实现 Tool**

创建: `src/mastra/tools/datasource/index.ts`

```typescript
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { getAdapter } from "./adapters"
import { db } from "../../../db"
import { SQLiteDatasourceRepository } from "../../../db/repositories/datasource-repository"

export { type DatasourceAdapter, type DatasourceConfig, type DatasourceResult } from "./types"

const repo = new SQLiteDatasourceRepository(db)

/**
 * 数据源查询工具 — Agent 调用此工具从已注册的第三方系统实时抓取数据
 *
 * Agent 不需要知道底层是 REST、GraphQL 还是其他协议，
 * 只需指定数据源 ID 和查询参数。
 */
export const datasourceQueryTool = createTool({
  id: "datasource-query",
  description:
    "从已注册的第三方数据源（MES、ERP 等工业系统）实时查询数据。" +
    "需要指定数据源 ID 和查询参数。不同类型的数据源参数不同：" +
    "REST 类型需要 path、method；GraphQL 类型需要 query、variables。",
  inputSchema: z.object({
    datasourceId: z.string().describe("数据源 ID"),
    params: z
      .record(z.unknown())
      .describe("查询参数（REST: path/method/body; GraphQL: query/variables）"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    metadata: z
      .object({
        duration: z.number(),
        datasourceId: z.string(),
        datasourceName: z.string(),
      })
      .optional(),
  }),
  execute: async ({ datasourceId, params }, { resourceId }) => {
    // resourceId = 当前 Agent ID（Mastra 在调用 Tool 时注入）
    const agentId = resourceId

    // 1. 从 DB 查数据源配置
    const config = await repo.findById(datasourceId)
    if (!config) {
      return { success: false, error: `数据源 "${datasourceId}" 未找到` }
    }
    if (!config.enabled) {
      return { success: false, error: `数据源 "${config.name}" 已禁用` }
    }

    // 2. 权限校验 — 检查此 Agent 是否绑定了该数据源
    if (agentId) {
      const bindings = await repo.getAgentBindings(agentId)
      if (bindings.length > 0 && !bindings.includes(datasourceId)) {
        return { success: false, error: `当前 Agent 无权访问数据源 "${config.name}"` }
      }
    }

    // 3. 获取对应协议的适配器
    const adapter = getAdapter(config.type)
    if (!adapter) {
      return { success: false, error: `不支持的数据源类型: ${config.type}` }
    }

    // 4. 执行查询
    return adapter.query(
      {
        id: config.id,
        name: config.name,
        type: config.type as any,
        auth: config.auth,
        config: config.config,
        enabled: config.enabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      params,
    )
  },
})

/**
 * 列出当前 Agent 可用的数据源
 */
export const datasourceListTool = createTool({
  id: "datasource-list",
  description: "列出当前 Agent 可用的数据源（第三方系统），返回每个数据源的 ID、名称、类型和描述。",
  inputSchema: z.object({}),
  outputSchema: z.object({
    datasources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        description: z.string().nullable(),
      }),
    ),
  }),
  execute: async (_input, { resourceId }) => {
    const agentId = resourceId
    // 如果 Agent 有绑定关系，只返回绑定的；否则返回全部启用的
    const list = agentId ? await repo.findByAgentId(agentId) : await repo.findAllEnabled()
    return {
      datasources: list.map((ds) => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
        description: ds.description,
      })),
    }
  },
})
```

**Step 3: 把 Tool 挂到 Agent**

修改: `src/mastra/agents/chat-agent.ts` — 添加 tools

```typescript
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"

export const chatAgent = new Agent({
  // ... 现有配置
  tools: { datasourceQueryTool, datasourceListTool },
})
```

修改: `src/mastra/index.ts` — 注册 tools

```typescript
import { datasourceQueryTool, datasourceListTool } from "./tools/datasource"

export const mastra = new Mastra({
  agents: { chatAgent, researchAgent, codeAgent },
  // Mastra 级别注册让所有 Agent 可用
})
```

**Step 4: 运行全部测试**

```bash
bun run test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: 创建 datasource-query 和 datasource-list Mastra Tool"
```

---

## Phase 4: API 路由 + 管理后台 UI

### Task 7: 数据源 CRUD API 路由

**Objective:** 为管理后台提供 RESTful API

**Files:**

- Create: `src/app/api/datasources/route.ts` — GET (列表) + POST (创建)
- Create: `src/app/api/datasources/[id]/route.ts` — GET (详情) + PUT (更新) + DELETE (删除)
- Create: `src/app/api/datasources/[id]/test/route.ts` — POST (测试连接)

**Step 1: 实现列表 + 创建路由**

创建: `src/app/api/datasources/route.ts`

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { SQLiteDatasourceRepository } from "@/db/repositories/datasource-repository"

const repo = new SQLiteDatasourceRepository(db)

export async function GET() {
  const datasources = await repo.findAll()
  return NextResponse.json(datasources)
}

export async function POST(req: Request) {
  const body = await req.json()
  try {
    const ds = await repo.create(body)
    return NextResponse.json(ds, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 400 },
    )
  }
}
```

**Step 2: 实现详情 + 更新 + 删除路由**

创建: `src/app/api/datasources/[id]/route.ts`

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { SQLiteDatasourceRepository } from "@/db/repositories/datasource-repository"

const repo = new SQLiteDatasourceRepository(db)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = await repo.findById(id)
  if (!ds) return NextResponse.json({ error: "未找到" }, { status: 404 })
  return NextResponse.json(ds)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  try {
    const ds = await repo.update(id, body)
    return NextResponse.json(ds)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失败" },
      { status: 400 },
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await repo.delete(id)
  return NextResponse.json({ ok: true })
}
```

**Step 3: 实现测试连接路由**

创建: `src/app/api/datasources/[id]/test/route.ts`

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { SQLiteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "@/mastra/tools/datasource/adapters"

const repo = new SQLiteDatasourceRepository(db)

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = await repo.findById(id)
  if (!ds) return NextResponse.json({ error: "未找到" }, { status: 404 })

  const adapter = getAdapter(ds.type)
  if (!adapter) return NextResponse.json({ ok: false, message: `不支持的类型: ${ds.type}` })

  const result = await adapter.testConnection({
    id: ds.id,
    name: ds.name,
    type: ds.type as any,
    auth: ds.auth,
    config: ds.config,
    enabled: ds.enabled,
    createdAt: ds.createdAt,
    updatedAt: ds.updatedAt,
  })
  return NextResponse.json(result)
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 添加数据源 CRUD + 测试连接 API 路由"
```

---

### Task 8: 管理后台 — 数据源列表页

**Objective:** 在 `/admin/datasources` 创建数据源管理列表页面

**Files:**

- Create: `src/app/admin/layout.tsx` — 管理后台布局
- Create: `src/app/admin/datasources/page.tsx` — 数据源列表
- Create: `src/hooks/use-datasources.ts` — 数据获取 hook

**Step 1: 管理后台布局**

创建: `src/app/admin/layout.tsx`

```tsx
import Link from "next/link"
import { ArrowLeft, Database } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col h-dvh max-w-4xl mx-auto w-full px-4 py-4">
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">管理后台</h1>
      </header>
      <nav className="flex gap-2 mb-6">
        <Link
          href="/admin/datasources"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          <Database className="size-4" />
          数据源管理
        </Link>
      </nav>
      {children}
    </main>
  )
}
```

**Step 2: 数据获取 hook**

创建: `src/hooks/use-datasources.ts`

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"

export interface Datasource {
  id: string
  name: string
  description: string | null
  type: string
  auth: Record<string, unknown>
  config: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function useDatasources() {
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/datasources")
      if (!res.ok) throw new Error("获取数据源列表失败")
      setDatasources(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const remove = useCallback(
    async (id: string) => {
      await fetch(`/api/datasources/${id}`, { method: "DELETE" })
      await refresh()
    },
    [refresh],
  )

  const testConnection = useCallback(async (id: string) => {
    const res = await fetch(`/api/datasources/${id}/test`, { method: "POST" })
    return res.json() as Promise<{ ok: boolean; message: string }>
  }, [])

  return { datasources, loading, error, refresh, remove, testConnection }
}
```

**Step 3: 数据源列表页**

创建: `src/app/admin/datasources/page.tsx`

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useDatasources } from "@/hooks/use-datasources"
import { Plus, Trash2, Zap, Pencil } from "lucide-react"

const typeLabels: Record<string, string> = {
  rest: "REST API",
  graphql: "GraphQL",
  grpc: "gRPC",
  opcua: "OPC UA",
  mqtt: "MQTT",
}

export default function DatasourcesPage() {
  const { datasources, loading, remove, testConnection } = useDatasources()
  const [testing, setTesting] = useState<Record<string, string>>({})

  async function handleTest(id: string) {
    setTesting((prev) => ({ ...prev, [id]: "testing" }))
    const result = await testConnection(id)
    setTesting((prev) => ({ ...prev, [id]: result.ok ? "ok" : `失败: ${result.message}` }))
    setTimeout(
      () =>
        setTesting((prev) => {
          const n = { ...prev }
          delete n[id]
          return n
        }),
      3000,
    )
  }

  if (loading) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">数据源列表</h2>
        <Link
          href="/admin/datasources/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
        >
          <Plus className="size-4" />
          新增数据源
        </Link>
      </div>

      {datasources.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>暂无数据源</p>
          <p className="text-sm mt-1">点击"新增数据源"添加你的 MES、ERP 等系统</p>
        </div>
      ) : (
        <div className="space-y-3">
          {datasources.map((ds) => (
            <div
              key={ds.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ds.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {typeLabels[ds.type] ?? ds.type}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ds.enabled ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                    }`}
                  >
                    {ds.enabled ? "启用" : "禁用"}
                  </span>
                </div>
                {ds.description && (
                  <p className="text-sm text-muted-foreground mt-1">{ds.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">ID: {ds.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {testing[ds.id] && (
                  <span
                    className={`text-xs ${
                      testing[ds.id] === "testing"
                        ? "text-muted-foreground"
                        : testing[ds.id] === "ok"
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {testing[ds.id] === "testing" ? "测试中..." : testing[ds.id]}
                  </span>
                )}
                <button
                  onClick={() => handleTest(ds.id)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="测试连接"
                >
                  <Zap className="size-4" />
                </button>
                <Link
                  href={`/admin/datasources/${ds.id}/edit`}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="编辑"
                >
                  <Pencil className="size-4" />
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`确认删除 "${ds.name}"？`)) remove(ds.id)
                  }}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-red-600 transition-colors"
                  title="删除"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 添加数据源管理列表页 /admin/datasources"
```

---

### Task 9: 管理后台 — 新增/编辑数据源表单

**Objective:** 创建数据源的新增和编辑表单页面，支持选择协议类型、配置认证、填写连接参数

**Files:**

- Create: `src/app/admin/datasources/new/page.tsx` — 新增页面
- Create: `src/app/admin/datasources/[id]/edit/page.tsx` — 编辑页面
- Create: `src/components/datasource-form.tsx` — 共享表单组件

**Step 1: 表单组件**

创建: `src/components/datasource-form.tsx`

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const adapterTypes = [
  { value: "rest", label: "REST API", hint: "标准 HTTP 接口" },
  { value: "graphql", label: "GraphQL", hint: "GraphQL 端点" },
  { value: "grpc", label: "gRPC", hint: "Google gRPC 远程调用" },
  { value: "opcua", label: "OPC UA", hint: "工业自动化标准协议" },
  { value: "mqtt", label: "MQTT", hint: "消息队列物联网传输" },
]

const authTypes = [
  { value: "none", label: "无认证" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "apikey", label: "API Key" },
]

interface DatasourceFormData {
  id: string
  name: string
  description: string
  type: string
  auth: Record<string, unknown>
  config: Record<string, unknown>
  enabled: boolean
}

interface Props {
  initialData?: DatasourceFormData
  isEdit?: boolean
}

export function DatasourceForm({ initialData, isEdit }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<DatasourceFormData>(
    initialData ?? {
      id: "",
      name: "",
      description: "",
      type: "rest",
      auth: { type: "none" },
      config: {},
      enabled: true,
    },
  )
  const [authType, setAuthType] = useState((initialData?.auth as any)?.type ?? "none")

  function updateField<K extends keyof DatasourceFormData>(key: K, value: DatasourceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateAuth(type: string) {
    setAuthType(type)
    switch (type) {
      case "none":
        updateField("auth", { type: "none" })
        break
      case "bearer":
        updateField("auth", { type: "bearer", token: "" })
        break
      case "basic":
        updateField("auth", { type: "basic", username: "", password: "" })
        break
      case "apikey":
        updateField("auth", { type: "apikey", key: "", value: "", in: "header" })
        break
    }
  }

  function updateAuthField(key: string, value: string) {
    updateField("auth", { ...form.auth, [key]: value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const url = isEdit ? `/api/datasources/${form.id}` : "/api/datasources"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "保存失败")
      }
      router.push("/admin/datasources")
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm">{error}</div>}

      {/* 基本信息 */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>
        {!isEdit && (
          <div>
            <label className="block text-sm mb-1">数据源 ID</label>
            <input
              type="text"
              value={form.id}
              onChange={(e) => updateField("id", e.target.value)}
              placeholder="mes-production"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">唯一标识符，创建后不可修改</p>
          </div>
        )}
        <div>
          <label className="block text-sm mb-1">名称</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="MES 生产管理系统"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="用于查询生产订单、工序进度等数据"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => updateField("enabled", e.target.checked)}
            id="enabled"
          />
          <label htmlFor="enabled" className="text-sm">
            启用
          </label>
        </div>
      </section>

      {/* 协议类型 */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">接入协议</h3>
        <div className="flex flex-wrap gap-2">
          {adapterTypes.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                updateField("type", value)
                updateField("config", {})
              }}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                form.type === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
              title={hint}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 连接配置 — 按类型动态展示 */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">连接配置</h3>
        {(form.type === "rest" || form.type === "graphql") && (
          <div>
            <label className="block text-sm mb-1">
              {form.type === "rest" ? "Base URL" : "GraphQL Endpoint"}
            </label>
            <input
              type="url"
              value={((form.config as any).baseUrl ?? (form.config as any).endpoint) || ""}
              onChange={(e) =>
                updateField("config", {
                  ...form.config,
                  [form.type === "rest" ? "baseUrl" : "endpoint"]: e.target.value,
                })
              }
              placeholder="https://mes.factory.com/api"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            />
          </div>
        )}
        {form.type === "grpc" && (
          <div>
            <label className="block text-sm mb-1">gRPC 服务地址</label>
            <input
              type="text"
              value={(form.config as any).address || ""}
              onChange={(e) => updateField("config", { ...form.config, address: e.target.value })}
              placeholder="mes.factory.com:50051"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            />
          </div>
        )}
        {form.type === "opcua" && (
          <div>
            <label className="block text-sm mb-1">OPC UA Endpoint URL</label>
            <input
              type="text"
              value={(form.config as any).endpointUrl || ""}
              onChange={(e) =>
                updateField("config", { ...form.config, endpointUrl: e.target.value })
              }
              placeholder="opc.tcp://plc.factory.com:4840"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            />
          </div>
        )}
        {form.type === "mqtt" && (
          <>
            <div>
              <label className="block text-sm mb-1">MQTT Broker URL</label>
              <input
                type="text"
                value={(form.config as any).brokerUrl || ""}
                onChange={(e) =>
                  updateField("config", { ...form.config, brokerUrl: e.target.value })
                }
                placeholder="mqtt://broker.factory.com:1883"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">默认 Topic</label>
              <input
                type="text"
                value={(form.config as any).defaultTopic || ""}
                onChange={(e) =>
                  updateField("config", { ...form.config, defaultTopic: e.target.value })
                }
                placeholder="factory/line1/status"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm mb-1">超时时间（毫秒）</label>
          <input
            type="number"
            value={(form.config as any).timeout || 30000}
            onChange={(e) =>
              updateField("config", { ...form.config, timeout: Number(e.target.value) })
            }
            className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>
      </section>

      {/* 认证 */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">认证方式</h3>
        <div className="flex flex-wrap gap-2">
          {authTypes.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateAuth(value)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                authType === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {authType === "bearer" && (
          <div>
            <label className="block text-sm mb-1">Token</label>
            <input
              type="password"
              value={(form.auth as any).token || ""}
              onChange={(e) => updateAuthField("token", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            />
          </div>
        )}
        {authType === "basic" && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm mb-1">用户名</label>
              <input
                type="text"
                value={(form.auth as any).username || ""}
                onChange={(e) => updateAuthField("username", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm mb-1">密码</label>
              <input
                type="password"
                value={(form.auth as any).password || ""}
                onChange={(e) => updateAuthField("password", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                required
              />
            </div>
          </div>
        )}
        {authType === "apikey" && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm mb-1">Key 名称</label>
                <input
                  type="text"
                  value={(form.auth as any).key || ""}
                  onChange={(e) => updateAuthField("key", e.target.value)}
                  placeholder="X-API-Key"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1">Value</label>
                <input
                  type="password"
                  value={(form.auth as any).value || ""}
                  onChange={(e) => updateAuthField("value", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(["header", "query"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => updateAuthField("in", pos)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    (form.auth as any).in === pos
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {pos === "header" ? "放在 Header" : "放在 Query"}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 提交 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : isEdit ? "保存修改" : "创建数据源"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/datasources")}
          className="px-6 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          取消
        </button>
      </div>
    </form>
  )
}
```

**Step 2: 新增页面**

创建: `src/app/admin/datasources/new/page.tsx`

```tsx
import { DatasourceForm } from "@/components/datasource-form"

export default function NewDatasourcePage() {
  return (
    <div>
      <h2 className="text-lg font-medium mb-4">新增数据源</h2>
      <DatasourceForm />
    </div>
  )
}
```

**Step 3: 编辑页面**

创建: `src/app/admin/datasources/[id]/edit/page.tsx`

```tsx
"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { DatasourceForm } from "@/components/datasource-form"

export default function EditDatasourcePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/datasources/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
  }, [id])

  if (loading) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">编辑数据源</h2>
      <DatasourceForm initialData={data!} isEdit />
    </div>
  )
}
```

**Step 4: 在设置页面添加管理后台入口**

修改: `src/app/settings/page.tsx` — 在"关于"section 之前添加

```tsx
{
  /* 管理后台 */
}
;<section className="mb-8">
  <h2 className="text-sm font-medium text-muted-foreground mb-3">管理</h2>
  <Link
    href="/admin/datasources"
    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm w-fit"
  >
    <Database className="size-4" />
    数据源管理
  </Link>
</section>
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: 添加数据源新增/编辑表单页面"
```

---

## Phase 5: 后续适配器（按需实现）

### Task 7: gRPC Adapter（后续）

需要 `@grpc/grpc-js` + `@grpc/proto-loader`。Agent 传入 proto 定义 + service + method + 参数。

### Task 8: OPC UA Adapter（后续）

需要 `node-opcua-client`。配置含 endpointUrl、securityMode。查询参数为 nodeId 数组。

### Task 9: MQTT Adapter（后续）

需要 `mqtt`。订阅模式 — 可能需要引入短时订阅 + 超时机制，因为 MQTT 是推模型不是拉模型。

---

## 文件变更总览

```
新增:
  drizzle.config.ts
  src/db/index.ts
  src/db/schema.ts
  src/db/repositories/datasource-repository.ts
  src/db/repositories/__tests__/datasource-repository.test.ts
  src/mastra/tools/datasource/types.ts
  src/mastra/tools/datasource/index.ts
  src/mastra/tools/datasource/__tests__/datasource-tool.test.ts
  src/mastra/tools/datasource/adapters/index.ts
  src/mastra/tools/datasource/adapters/rest-adapter.ts
  src/mastra/tools/datasource/adapters/graphql-adapter.ts
  src/mastra/tools/datasource/adapters/__tests__/rest-adapter.test.ts
  src/mastra/tools/datasource/adapters/__tests__/graphql-adapter.test.ts
  src/app/api/datasources/route.ts
  src/app/api/datasources/[id]/route.ts
  src/app/api/datasources/[id]/test/route.ts
  src/app/admin/layout.tsx
  src/app/admin/datasources/page.tsx
  src/app/admin/datasources/new/page.tsx
  src/app/admin/datasources/[id]/edit/page.tsx
  src/components/datasource-form.tsx
  src/hooks/use-datasources.ts
  data/                               (SQLite 数据文件目录, gitignore)

修改:
  package.json                        (新增 drizzle 依赖)
  src/mastra/agents/chat-agent.ts     (挂载 Tool)
  src/mastra/index.ts                 (可选)
  src/app/settings/page.tsx           (添加管理后台入口)
  .gitignore                          (添加 data/)
```

## 验证标准

- [ ] `bun run test` 全绿
- [ ] REST Adapter 能 mock 调通 GET/POST + 4 种认证
- [ ] GraphQL Adapter 能 mock 调通 query + variables
- [ ] Repository CRUD 在内存 SQLite 测试通过
- [ ] Agent 通过 `datasource-query` Tool 能端到端查到数据
- [ ] 新增 Adapter 只需: 新建文件 + registerAdapter() — 不改现有代码
