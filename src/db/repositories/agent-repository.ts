import { eq } from "drizzle-orm"
import type { DB } from "@/db"
import { customAgents, agentDatasources } from "@/db/schema"

/** 自定义 Agent 记录 */
export interface AgentRecord {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  modelId: string | null
  icon: string | null
  isBuiltin: boolean
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/** 创建 Agent 的输入 */
export interface CreateAgentInput {
  id: string
  name: string
  description?: string
  systemPrompt?: string
  modelId?: string
  icon?: string
  isBuiltin?: boolean
  enabled?: boolean
}

/** 更新 Agent 的输入 */
export interface UpdateAgentInput {
  name?: string
  description?: string
  systemPrompt?: string
  modelId?: string | null
  icon?: string | null
  enabled?: boolean
}

/** Agent 仓储接口 */
export interface AgentRepository {
  create(input: CreateAgentInput): Promise<AgentRecord>
  findById(id: string): Promise<AgentRecord | null>
  findAll(): Promise<AgentRecord[]>
  findEnabled(): Promise<AgentRecord[]>
  update(id: string, input: UpdateAgentInput): Promise<AgentRecord | null>
  delete(id: string): Promise<boolean>
}

/** SQLite 实现 */
export class SqliteAgentRepository implements AgentRepository {
  constructor(private db: DB) {}

  async create(input: CreateAgentInput): Promise<AgentRecord> {
    const now = new Date()
    const row = this.db
      .insert(customAgents)
      .values({
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        systemPrompt: input.systemPrompt ?? "",
        modelId: input.modelId ?? null,
        icon: input.icon ?? null,
        isBuiltin: input.isBuiltin ?? false,
        enabled: input.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()
    return row as AgentRecord
  }

  async findById(id: string): Promise<AgentRecord | null> {
    const row = this.db.select().from(customAgents).where(eq(customAgents.id, id)).get()
    return (row as AgentRecord) ?? null
  }

  async findAll(): Promise<AgentRecord[]> {
    return this.db.select().from(customAgents).all() as AgentRecord[]
  }

  async findEnabled(): Promise<AgentRecord[]> {
    return this.db
      .select()
      .from(customAgents)
      .where(eq(customAgents.enabled, true))
      .all() as AgentRecord[]
  }

  async update(id: string, input: UpdateAgentInput): Promise<AgentRecord | null> {
    const existing = await this.findById(id)
    if (!existing) return null

    // 内置 Agent 不允许修改
    if (existing.isBuiltin) {
      throw new Error("内置 Agent 不可修改")
    }

    const row = this.db
      .update(customAgents)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(customAgents.id, id))
      .returning()
      .get()
    return (row as AgentRecord) ?? null
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id)
    if (!existing) return false

    // 内置 Agent 不允许删除
    if (existing.isBuiltin) {
      throw new Error("内置 Agent 不可删除")
    }

    // 先删除关联的数据源绑定
    this.db.delete(agentDatasources).where(eq(agentDatasources.agentId, id)).run()

    const result = this.db.delete(customAgents).where(eq(customAgents.id, id)).run()
    return result.changes > 0
  }
}
