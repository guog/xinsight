import { NextResponse } from "next/server"
import { mastra } from "@/mastra"

/** GET /api/agents — 获取所有已注册的 Mastra Agent 列表 */
export async function GET() {
  try {
    const agentsMap = mastra.listAgents()
    const agents = Object.values(agentsMap).map((agent) => ({
      id: agent.id,
      name: agent.name,
    }))
    return NextResponse.json(agents)
  } catch (error) {
    console.error("获取 Agent 列表失败:", error)
    return NextResponse.json({ error: "获取 Agent 列表失败" }, { status: 500 })
  }
}
