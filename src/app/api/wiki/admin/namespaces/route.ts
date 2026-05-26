import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiNamespaces, agentWikiNamespaces } from "@/db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"

export async function GET() {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const nss = await db.select().from(wikiNamespaces).all()
    const results = await Promise.all(
      nss.map(async (ns) => {
        const bindings = await db
          .select({ agentId: agentWikiNamespaces.agentId })
          .from(agentWikiNamespaces)
          .where(eq(agentWikiNamespaces.namespaceId, ns.id))
          .all()
        return {
          ...ns,
          agentIds: bindings.map((b) => b.agentId),
        }
      }),
    )
    return NextResponse.json(results)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未知错误" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { name, displayName, description, agentIds } = await req.json()
    if (!name || !displayName) {
      return NextResponse.json({ error: "分区标识和显示名称为必填项" }, { status: 400 })
    }

    // 验证标识符不能包含非法路径字符
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      return NextResponse.json({ error: "分区标识不能包含非法路径字符" }, { status: 400 })
    }

    const existing = await db
      .select()
      .from(wikiNamespaces)
      .where(eq(wikiNamespaces.name, name))
      .get()
    if (existing) {
      return NextResponse.json({ error: "分区标识已存在" }, { status: 400 })
    }

    const nsId = nanoid()
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx.insert(wikiNamespaces).values({
        id: nsId,
        name,
        displayName,
        description: description || null,
        createdAt: now,
        updatedAt: now,
      })

      if (Array.isArray(agentIds) && agentIds.length > 0) {
        await tx.insert(agentWikiNamespaces).values(
          agentIds.map((agentId) => ({
            agentId,
            namespaceId: nsId,
            createdAt: now,
          })),
        )
      }
    })

    return NextResponse.json({ ok: true, id: nsId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未知错误" }, { status: 500 })
  }
}
