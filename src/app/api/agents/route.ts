import { NextResponse } from "next/server"
import { mastra } from "@/mastra"
import { requireAuth, handleAuthError } from "@/lib/auth"
import { db } from "@/db"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"

/** GET /api/agents — 获取所有已注册且被当前用户授权的 Mastra Agent 列表 */
export async function GET() {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error) ?? NextResponse.json({ error: "未知错误" }, { status: 500 })
    }

    const agentRepo = new SqliteAgentRepository(db)
    const authorizedAgents = await agentRepo.getAuthorizedAgentsForUser(user.id, user.role)
    const agentsMap = mastra.listAgents()

    // 过滤出在代码中已注册且被该用户授权的 Agent 列表
    const agents = authorizedAgents
      .filter((agent) => !!agentsMap[agent.id])
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
      }))

    return NextResponse.json(agents)
  } catch (error) {
    console.error("获取 Agent 列表失败:", error)
    return NextResponse.json({ error: "获取 Agent 列表失败" }, { status: 500 })
  }
}
