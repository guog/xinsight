import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiUploads } from "@/db/schema"
import { desc } from "drizzle-orm"

// 获取所有上传记录
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 })
  }

  const uploads = await db.select().from(wikiUploads).orderBy(desc(wikiUploads.createdAt))
  return NextResponse.json({ uploads })
}
