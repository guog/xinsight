import { eq, and, or, inArray } from "drizzle-orm"
import type { DB } from "@/db"
import { customAgents, agentDatasources, agentPermissions, userTeams } from "@/db/schema"

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

export interface AgentPermissionRecord {
  id: string
  agentId: string
  subjectType: string
  subjectId: string
  permissionType: string
  createdAt: Date
}

export interface AgentPermissionInput {
  subjectType: "role" | "team" | "user"
  subjectId: string
  permissionType?: string
}

/** Agent 仓储接口 */
export interface AgentRepository {
  create(input: CreateAgentInput): Promise<AgentRecord>
  findById(id: string): Promise<AgentRecord | null>
  findAll(): Promise<AgentRecord[]>
  findEnabled(): Promise<AgentRecord[]>
  update(id: string, input: UpdateAgentInput): Promise<AgentRecord | null>
  delete(id: string): Promise<boolean>
  getAuthorizedAgentsForUser(userId: string, role: string): Promise<AgentRecord[]>
  getPermissions(agentId: string): Promise<AgentPermissionRecord[]>
  updatePermissions(agentId: string, permissions: AgentPermissionInput[]): Promise<void>
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

    // 先删除关联的数据源绑定和权限绑定
    this.db.delete(agentDatasources).where(eq(agentDatasources.agentId, id)).run()
    this.db.delete(agentPermissions).where(eq(agentPermissions.agentId, id)).run()

    const result = this.db.delete(customAgents).where(eq(customAgents.id, id)).run() as unknown as {
      changes: number
    }
    return result.changes > 0
  }

  async getAuthorizedAgentsForUser(userId: string, role: string): Promise<AgentRecord[]> {
    // 1. 如果是管理员，默认返回所有启用的 Agent
    if (role === "admin") {
      return this.findEnabled()
    }

    // 2. 查找用户关联的团队 IDs
    const userTeamRows = this.db
      .select({ teamId: userTeams.teamId })
      .from(userTeams)
      .where(eq(userTeams.userId, userId))
      .all()
    const teamIds = userTeamRows.map((r) => r.teamId)

    // 3. 查出哪些 Agent 至少被配置了一项可见性限制
    const restrictedAgentRows = this.db
      .selectDistinct({ agentId: agentPermissions.agentId })
      .from(agentPermissions)
      .all()
    const restrictedAgentIds = new Set(restrictedAgentRows.map((r) => r.agentId))

    // 4. 查出被授权给该用户的 Agent IDs
    const conditions = [
      and(eq(agentPermissions.subjectType, "user"), eq(agentPermissions.subjectId, userId)),
      and(eq(agentPermissions.subjectType, "role"), eq(agentPermissions.subjectId, role)),
    ]
    if (teamIds.length > 0) {
      conditions.push(
        and(eq(agentPermissions.subjectType, "team"), inArray(agentPermissions.subjectId, teamIds)),
      )
    }

    const allowedAgentRows = this.db
      .selectDistinct({ agentId: agentPermissions.agentId })
      .from(agentPermissions)
      .where(or(...conditions))
      .all()
    const allowedAgentIds = new Set(allowedAgentRows.map((r) => r.agentId))

    // 5. 过滤启用的 Agent
    const allEnabled = await this.findEnabled()
    return allEnabled.filter((agent) => {
      // 如果没有设置任何限制（公开的），或者该用户被明确授权了，即可访问
      return !restrictedAgentIds.has(agent.id) || allowedAgentIds.has(agent.id)
    })
  }

  async getPermissions(agentId: string): Promise<AgentPermissionRecord[]> {
    return this.db
      .select()
      .from(agentPermissions)
      .where(eq(agentPermissions.agentId, agentId))
      .all() as AgentPermissionRecord[]
  }

  async updatePermissions(agentId: string, permissions: AgentPermissionInput[]): Promise<void> {
    this.db.delete(agentPermissions).where(eq(agentPermissions.agentId, agentId)).run()

    for (const p of permissions) {
      this.db
        .insert(agentPermissions)
        .values({
          id: crypto.randomUUID(),
          agentId,
          subjectType: p.subjectType,
          subjectId: p.subjectId,
          permissionType: p.permissionType ?? "read",
          createdAt: new Date(),
        })
        .run()
    }
  }
}
