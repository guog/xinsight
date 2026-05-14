import { eq, and, sql } from "drizzle-orm"
import type { DB } from "@/db"
import { datasources, agentDatasources } from "@/db/schema"
import type { DatasourceEndpoint } from "@/mastra/tools/datasource/types"

/** 数据源记录（从数据库读取后的结构） */
export interface DatasourceRecord {
  id: string
  name: string
  description: string | null
  type: string
  auth: Record<string, unknown>
  config: Record<string, unknown>
  endpoints: DatasourceEndpoint[]
  enabled: boolean
  lastTestedAt: Date | null
  lastTestResult: string | null
  lastTestMessage: string | null
  lastCalledAt: Date | null
  callCount: number
  createdAt: Date
  updatedAt: Date
}

/** 创建数据源的输入 */
export interface CreateDatasourceInput {
  id: string
  name: string
  description?: string
  type: string
  auth: Record<string, unknown>
  config: Record<string, unknown>
  endpoints?: DatasourceEndpoint[]
  enabled?: boolean
}

/** 更新数据源的输入 */
export interface UpdateDatasourceInput {
  name?: string
  description?: string
  type?: string
  auth?: Record<string, unknown>
  config?: Record<string, unknown>
  endpoints?: DatasourceEndpoint[]
  enabled?: boolean
}

/** 数据源仓储抽象接口 */
export interface DatasourceRepository {
  create(input: CreateDatasourceInput): Promise<DatasourceRecord>
  findById(id: string): Promise<DatasourceRecord | null>
  findAll(): Promise<DatasourceRecord[]>
  findAllEnabled(): Promise<DatasourceRecord[]>
  findByAgentId(agentId: string): Promise<DatasourceRecord[]>
  update(id: string, input: UpdateDatasourceInput): Promise<DatasourceRecord>
  delete(id: string): Promise<void>
  bindAgent(agentId: string, datasourceId: string, endpointIds?: string[]): Promise<void>
  unbindAgent(agentId: string, datasourceId: string): Promise<void>
  getAgentBindings(agentId: string): Promise<string[]>
  getAgentEndpointBindings(
    agentId: string,
  ): Promise<{ datasourceId: string; endpointIds: string[] | null }[]>
  getDatasourceAgents(datasourceId: string): Promise<string[]>
  updateTestResult(id: string, result: "ok" | "failed", message?: string): Promise<DatasourceRecord>
  recordCall(id: string): Promise<DatasourceRecord>
}

/** 将数据库行转换为 DatasourceRecord */
function toRecord(row: typeof datasources.$inferSelect): DatasourceRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    auth: JSON.parse(row.auth),
    config: JSON.parse(row.config),
    endpoints: JSON.parse(row.endpoints),
    enabled: row.enabled,
    lastTestedAt: row.lastTestedAt,
    lastTestResult: row.lastTestResult,
    lastTestMessage: row.lastTestMessage,
    lastCalledAt: row.lastCalledAt,
    callCount: row.callCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** SQLite 实现 */
export class SqliteDatasourceRepository implements DatasourceRepository {
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
      endpoints: JSON.stringify(input.endpoints ?? []),
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.insert(datasources).values(row)
    return this.findById(input.id) as Promise<DatasourceRecord>
  }

  async findById(id: string): Promise<DatasourceRecord | null> {
    const rows = await this.db.select().from(datasources).where(eq(datasources.id, id))
    return rows.length ? toRecord(rows[0]) : null
  }

  async findAll(): Promise<DatasourceRecord[]> {
    const rows = await this.db.select().from(datasources)
    return rows.map(toRecord)
  }

  async findAllEnabled(): Promise<DatasourceRecord[]> {
    const rows = await this.db.select().from(datasources).where(eq(datasources.enabled, true))
    return rows.map(toRecord)
  }

  async findByAgentId(agentId: string): Promise<DatasourceRecord[]> {
    const rows = await this.db
      .select({ ds: datasources })
      .from(agentDatasources)
      .innerJoin(datasources, eq(agentDatasources.datasourceId, datasources.id))
      .where(and(eq(agentDatasources.agentId, agentId), eq(datasources.enabled, true)))
    return rows.map((r) => toRecord(r.ds))
  }

  async update(id: string, input: UpdateDatasourceInput): Promise<DatasourceRecord> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) updates.name = input.name
    if (input.description !== undefined) updates.description = input.description
    if (input.type !== undefined) updates.type = input.type
    if (input.auth !== undefined) updates.auth = JSON.stringify(input.auth)
    if (input.config !== undefined) updates.config = JSON.stringify(input.config)
    if (input.endpoints !== undefined) updates.endpoints = JSON.stringify(input.endpoints)
    if (input.enabled !== undefined) updates.enabled = input.enabled

    await this.db.update(datasources).set(updates).where(eq(datasources.id, id))
    return this.findById(id) as Promise<DatasourceRecord>
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(datasources).where(eq(datasources.id, id))
  }

  async bindAgent(agentId: string, datasourceId: string, endpointIds?: string[]): Promise<void> {
    await this.db.insert(agentDatasources).values({
      agentId,
      datasourceId,
      createdAt: new Date(),
      endpointIds: endpointIds ? JSON.stringify(endpointIds) : null,
    })
  }

  async unbindAgent(agentId: string, datasourceId: string): Promise<void> {
    await this.db
      .delete(agentDatasources)
      .where(
        and(eq(agentDatasources.agentId, agentId), eq(agentDatasources.datasourceId, datasourceId)),
      )
  }

  async getAgentBindings(agentId: string): Promise<string[]> {
    const rows = await this.db
      .select({ datasourceId: agentDatasources.datasourceId })
      .from(agentDatasources)
      .where(eq(agentDatasources.agentId, agentId))
    return rows.map((r) => r.datasourceId)
  }

  /** 获取 Agent 的端点级绑定信息 */
  async getAgentEndpointBindings(
    agentId: string,
  ): Promise<{ datasourceId: string; endpointIds: string[] | null }[]> {
    const rows = await this.db
      .select({
        datasourceId: agentDatasources.datasourceId,
        endpointIds: agentDatasources.endpointIds,
      })
      .from(agentDatasources)
      .where(eq(agentDatasources.agentId, agentId))
    return rows.map((r) => ({
      datasourceId: r.datasourceId,
      endpointIds: r.endpointIds ? JSON.parse(r.endpointIds) : null,
    }))
  }

  async getDatasourceAgents(datasourceId: string): Promise<string[]> {
    const rows = await this.db
      .select({ agentId: agentDatasources.agentId })
      .from(agentDatasources)
      .where(eq(agentDatasources.datasourceId, datasourceId))
    return rows.map((r) => r.agentId)
  }

  async updateTestResult(
    id: string,
    result: "ok" | "failed",
    message?: string,
  ): Promise<DatasourceRecord> {
    await this.db
      .update(datasources)
      .set({
        lastTestedAt: new Date(),
        lastTestResult: result,
        lastTestMessage: message ?? null,
        updatedAt: new Date(),
      })
      .where(eq(datasources.id, id))
    return this.findById(id) as Promise<DatasourceRecord>
  }

  async recordCall(id: string): Promise<DatasourceRecord> {
    const result = await this.db
      .update(datasources)
      .set({
        lastCalledAt: new Date(),
        callCount: sql`${datasources.callCount} + 1`,
      })
      .where(eq(datasources.id, id))
      .returning()
    if (!result.length) throw new Error(`数据源不存在: ${id}`)
    return toRecord(result[0])
  }
}
