import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiFeedbacks, users } from "@/db/schema"
import { desc, eq } from "drizzle-orm"

export async function GET() {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }
  const feedbacks = db
    .select({
      id: wikiFeedbacks.id,
      pageId: wikiFeedbacks.pageId,
      userId: wikiFeedbacks.userId,
      username: users.username,
      displayName: users.displayName,
      type: wikiFeedbacks.type,
      content: wikiFeedbacks.content,
      status: wikiFeedbacks.status,
      reviewNote: wikiFeedbacks.reviewNote,
      reviewedAt: wikiFeedbacks.reviewedAt,
      createdAt: wikiFeedbacks.createdAt,
    })
    .from(wikiFeedbacks)
    .leftJoin(users, eq(wikiFeedbacks.userId, users.id))
    .orderBy(desc(wikiFeedbacks.createdAt))
    .all()
  return NextResponse.json(feedbacks)
}
