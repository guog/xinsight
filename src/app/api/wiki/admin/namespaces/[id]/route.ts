import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiNamespaces, agentWikiNamespaces } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { id } = await params
    const { displayName, description, agentIds } = await req.json()

    if (!displayName) {
      return NextResponse.json({ error: "显示名称为必填项" }, { status: 400 })
    }

    const existing = await db.select().from(wikiNamespaces).where(eq(wikiNamespaces.id, id)).get()
    if (!existing) {
      return NextResponse.json({ error: "分区不存在" }, { status: 404 })
    }

    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(wikiNamespaces)
        .set({
          displayName,
          description: description || null,
          updatedAt: now,
        })
        .where(eq(wikiNamespaces.id, id))

      // 重新更新绑定关系
      await tx.delete(agentWikiNamespaces).where(eq(agentWikiNamespaces.namespaceId, id))

      if (Array.isArray(agentIds) && agentIds.length > 0) {
        await tx.insert(agentWikiNamespaces).values(
          agentIds.map((agentId) => ({
            agentId,
            namespaceId: id,
            createdAt: now,
          })),
        )
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未知错误" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { id } = await params
    const existing = await db.select().from(wikiNamespaces).where(eq(wikiNamespaces.id, id)).get()
    if (!existing) {
      return NextResponse.json({ error: "分区不存在" }, { status: 404 })
    }

    // 由于在 SQLite schema 中设置了 ON DELETE CASCADE，删除 wikiNamespaces 即可自动删除相关的绑定关系
    await db.delete(wikiNamespaces).where(eq(wikiNamespaces.id, id))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未知错误" }, { status: 500 })
  }
}
