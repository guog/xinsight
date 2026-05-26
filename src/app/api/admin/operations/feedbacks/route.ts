import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { messageFeedbacks, chats, users, messages } from "@/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get("agentId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const offset = (page - 1) * limit

    // 联合查询反馈、会话、用户和消息内容
    const query = db
      .select({
        id: messageFeedbacks.id,
        type: messageFeedbacks.type,
        comment: messageFeedbacks.comment,
        createdAt: messageFeedbacks.createdAt,
        chatId: chats.id,
        chatTitle: chats.title,
        agentId: chats.agentId,
        username: users.username,
        displayName: users.displayName,
        messageContent: messages.parts, // 消息内容 (JSON 字符串)
      })
      .from(messageFeedbacks)
      .innerJoin(chats, eq(messageFeedbacks.chatId, chats.id))
      .innerJoin(users, eq(messageFeedbacks.userId, users.id))
      .innerJoin(messages, eq(messageFeedbacks.messageId, messages.id))

    // 过滤条件
    const conditions = []
    if (agentId) {
      conditions.push(eq(chats.agentId, agentId))
    }

    const filteredQuery = conditions.length > 0 ? query.where(and(...conditions)) : query

    // 分页和排序
    const rows = await filteredQuery
      .orderBy(desc(messageFeedbacks.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    // 统计总数以供分页
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(messageFeedbacks)
      .innerJoin(chats, eq(messageFeedbacks.chatId, chats.id))

    const totalConditions = []
    if (agentId) {
      totalConditions.push(eq(chats.agentId, agentId))
    }
    const finalTotalQuery =
      totalConditions.length > 0 ? totalQuery.where(and(...totalConditions)) : totalQuery

    const totalRow = await finalTotalQuery.get()
    const total = totalRow?.count || 0

    return NextResponse.json({
      feedbacks: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未知错误" }, { status: 500 })
  }
}
