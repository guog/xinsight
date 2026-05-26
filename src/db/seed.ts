import { db } from "@/db"
import { users, customAgents, teams, userTeams } from "@/db/schema"
import { eq, and } from "drizzle-orm"

/** 预置用户列表 */
const SEED_USERS = [
  { username: "admin", displayName: "管理员", role: "admin" },
  { username: "guest", displayName: "访客", role: "user" },
] as const

/** 预置用户的默认密码 */
const SEED_PASSWORD = "xinsight123"

/**
 * 预置系统用户（admin + guest）。
 * 幂等操作——已存在的用户不会重复创建。
 * 在应用启动时（db/index.ts migrate 之后）自动调用。
 */
export async function seedUsers() {
  for (const { username, displayName, role } of SEED_USERS) {
    const existing = db.select().from(users).where(eq(users.username, username)).get()
    if (existing) continue

    const passwordHash = await Bun.password.hash(SEED_PASSWORD, { algorithm: "bcrypt", cost: 10 })
    const now = new Date()

    db.insert(users)
      .values({
        id: crypto.randomUUID(),
        username,
        displayName,
        passwordHash,
        role,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }
}

/** 内置 Agent 列表 */
const BUILTIN_AGENTS = [
  { id: "chatAgent", name: "通用对话", description: "通用问答与闲聊", icon: "💬" },
  {
    id: "factoryDirectorAgent",
    name: "厂长（Supervisor）",
    description: "统筹协调所有子 Agent，意图路由与指代消解",
    icon: "🏭",
  },
  {
    id: "productionAgent",
    name: "生产管理",
    description: "生产订单、排程、工艺路线、产品溯源",
    icon: "⚙️",
  },
  {
    id: "qualityAgent",
    name: "质量管理",
    description: "质量检验、缺陷分析、SPC 统计过程控制",
    icon: "✅",
  },
  {
    id: "equipmentAgent",
    name: "设备管理",
    description: "设备状态、OEE、MTBF/MTTR、维保记录",
    icon: "🔧",
  },
  {
    id: "warehouseAgent",
    name: "仓储物流",
    description: "库存管理、出入库记录、库位管理",
    icon: "📦",
  },
  {
    id: "energyAgent",
    name: "能源管理",
    description: "能耗监测（电/水/气/汽）、能源告警",
    icon: "⚡",
  },
  { id: "wikiAgent", name: "知识库", description: "搜索和检索知识库文档", icon: "📚" },
  { id: "autoAgent", name: "自动模式", description: "自动切换对话/研究/代码模式", icon: "🤖" },
  { id: "researchAgent", name: "深度研究", description: "深度分析与结构化报告生成", icon: "🔬" },
] as const

/**
 * 预置内置 Agent 记录。
 * 幂等操作——已存在的 Agent 不会重复创建。
 */
export async function seedBuiltinAgents() {
  const now = new Date()
  for (const agent of BUILTIN_AGENTS) {
    const existing = db.select().from(customAgents).where(eq(customAgents.id, agent.id)).get()
    if (existing) continue

    db.insert(customAgents)
      .values({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        isBuiltin: true,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }
}

/**
 * 预置系统团队与用户关联。
 */
export async function seedTeams() {
  const seedTeamsList = [
    { id: "team-rd", name: "研发部", description: "负责技术研发与Agent开发" },
    { id: "team-prod", name: "生产部", description: "负责厂区日常生产调度" },
    { id: "team-qa", name: "质检部", description: "负责生产质量把控与检验" },
  ]

  for (const team of seedTeamsList) {
    const existing = db.select().from(teams).where(eq(teams.id, team.id)).get()
    if (existing) continue

    const now = new Date()
    db.insert(teams)
      .values({
        id: team.id,
        name: team.name,
        description: team.description,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  // 把 guest 默认加入研发部 (team-rd)
  const guestUser = db.select().from(users).where(eq(users.username, "guest")).get()
  if (guestUser) {
    const existingBinding = db
      .select()
      .from(userTeams)
      .where(and(eq(userTeams.userId, guestUser.id), eq(userTeams.teamId, "team-rd")))
      .get()
    if (!existingBinding) {
      db.insert(userTeams)
        .values({
          userId: guestUser.id,
          teamId: "team-rd",
          createdAt: new Date(),
        })
        .run()
    }
  }
}
