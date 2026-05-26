import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { messages, chats, messageFeedbacks } from "@/db/schema"
import { eq, gte, lte, and } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const startDateStr = searchParams.get("startDate")
    const endDateStr = searchParams.get("endDate")
    const filteredAgentId = searchParams.get("agentId")

    const start = startDateStr
      ? new Date(startDateStr)
      : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    // 默认结束日期设为今天最后一秒，以完整包含今日的数据
    const end = endDateStr ? new Date(new Date(endDateStr).setHours(23, 59, 59, 999)) : new Date()

    // 1. 查询在此期间的所有消息
    const allMsgs = await db
      .select({
        id: messages.id,
        createdAt: messages.createdAt,
        agentId: chats.agentId,
      })
      .from(messages)
      .innerJoin(chats, eq(messages.chatId, chats.id))
      .where(and(gte(messages.createdAt, start), lte(messages.createdAt, end)))
      .all()

    // 2. 查询在此期间的所有反馈
    const allFeedbacks = await db
      .select({
        id: messageFeedbacks.id,
        type: messageFeedbacks.type, // "up" | "down"
        createdAt: messageFeedbacks.createdAt,
        agentId: chats.agentId,
      })
      .from(messageFeedbacks)
      .innerJoin(chats, eq(messageFeedbacks.chatId, chats.id))
      .where(and(gte(messageFeedbacks.createdAt, start), lte(messageFeedbacks.createdAt, end)))
      .all()

    // 3. 内存聚合
    const filteredMsgs = filteredAgentId
      ? allMsgs.filter((m) => m.agentId === filteredAgentId)
      : allMsgs

    const filteredFbs = filteredAgentId
      ? allFeedbacks.filter((f) => f.agentId === filteredAgentId)
      : allFeedbacks

    const totalMessages = filteredMsgs.length
    const totalUp = filteredFbs.filter((f) => f.type === "up").length
    const totalDown = filteredFbs.filter((f) => f.type === "down").length
    const totalFeedbacks = totalUp + totalDown
    const satisfactionRate = totalFeedbacks > 0 ? Math.round((totalUp / totalFeedbacks) * 100) : 100

    // 按天聚合趋势：消息数、点赞数、点踩数
    const trendMap: Record<string, { date: string; messages: number; up: number; down: number }> =
      {}

    // 初始化日期区间中的每一天，防止折线图断截
    const temp = new Date(start)
    while (temp <= end) {
      const dateStr = temp.toISOString().split("T")[0]
      trendMap[dateStr] = { date: dateStr, messages: 0, up: 0, down: 0 }
      temp.setDate(temp.getDate() + 1)
    }

    filteredMsgs.forEach((m) => {
      const d = m.createdAt.toISOString().split("T")[0]
      if (trendMap[d]) {
        trendMap[d].messages++
      }
    })

    filteredFbs.forEach((f) => {
      const d = f.createdAt.toISOString().split("T")[0]
      if (trendMap[d]) {
        if (f.type === "up") trendMap[d].up++
        if (f.type === "down") trendMap[d].down++
      }
    })

    const trend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date))

    // 按 Agent 聚合互动量与好评率
    const agentMap: Record<
      string,
      { agentId: string; messages: number; up: number; down: number }
    > = {}

    allMsgs.forEach((m) => {
      if (!agentMap[m.agentId]) {
        agentMap[m.agentId] = { agentId: m.agentId, messages: 0, up: 0, down: 0 }
      }
      agentMap[m.agentId].messages++
    })

    allFeedbacks.forEach((f) => {
      if (!agentMap[f.agentId]) {
        agentMap[f.agentId] = { agentId: f.agentId, messages: 0, up: 0, down: 0 }
      }
      if (f.type === "up") agentMap[f.agentId].up++
      if (f.type === "down") agentMap[f.agentId].down++
    })

    const agentStats = Object.values(agentMap)
      .map((a) => {
        const fbTotal = a.up + a.down
        return {
          agentId: a.agentId,
          messages: a.messages,
          satisfactionRate: fbTotal > 0 ? Math.round((a.up / fbTotal) * 100) : 100,
          up: a.up,
          down: a.down,
        }
      })
      .sort((a, b) => b.messages - a.messages)

    return NextResponse.json({
      summary: {
        totalMessages,
        totalFeedbacks,
        totalUp,
        totalDown,
        satisfactionRate,
      },
      trend,
      agentStats,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未知错误" }, { status: 500 })
  }
}
