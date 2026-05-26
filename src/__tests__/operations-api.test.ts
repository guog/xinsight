import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { db } from "@/db"
import {
  wikiNamespaces,
  agentWikiNamespaces,
  chats,
  messages,
  messageFeedbacks,
  users,
} from "@/db/schema"
import { GET as getStats } from "@/app/api/admin/operations/stats/route"
import { GET as getFeedbacks } from "@/app/api/admin/operations/feedbacks/route"
import { GET as getNamespaces, POST as postNamespace } from "@/app/api/wiki/admin/namespaces/route"
import {
  PUT as putNamespace,
  DELETE as deleteNamespace,
} from "@/app/api/wiki/admin/namespaces/[id]/route"
import { eq } from "drizzle-orm"

// 模拟身份校验，返回管理员
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi
    .fn()
    .mockResolvedValue({ id: "test-admin-id", username: "admin", role: "admin" }),
}))

describe("运营分析与分区管理 API 集成测试", () => {
  const now = new Date()
  const testUserId = "user-1"
  const testChatId = "chat-1"
  const testMessageId = "msg-1"

  beforeAll(async () => {
    // 1. 初始化基础测试数据，由于是内存 DB，需要确保表已经 migrate/建好
    // 我们手动在内存中为需要写入的表插点数据
    await db.delete(agentWikiNamespaces).run()
    await db.delete(wikiNamespaces).run()
    await db.delete(messageFeedbacks).run()
    await db.delete(messages).run()
    await db.delete(chats).run()
    await db.delete(users).run()

    await db
      .insert(users)
      .values({
        id: testUserId,
        username: "testuser",
        displayName: "测试用户",
        passwordHash: "hash",
        role: "user",
        createdAt: now,
        updatedAt: now,
      })
      .run()

    await db
      .insert(chats)
      .values({
        id: testChatId,
        title: "能源设备咨询",
        agentId: "energyAgent",
        userId: testUserId,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    await db
      .insert(messages)
      .values({
        id: testMessageId,
        chatId: testChatId,
        role: "assistant",
        parts: JSON.stringify([{ type: "text", text: "太阳能板发电效率很高。" }]),
        createdAt: now,
      })
      .run()

    await db
      .insert(messageFeedbacks)
      .values({
        id: "fb-1",
        messageId: testMessageId,
        chatId: testChatId,
        userId: testUserId,
        type: "up",
        comment: "很有帮助！",
        createdAt: now,
      })
      .run()
  })

  afterAll(async () => {
    await db.delete(agentWikiNamespaces).run()
    await db.delete(wikiNamespaces).run()
    await db.delete(messageFeedbacks).run()
    await db.delete(messages).run()
    await db.delete(chats).run()
    await db.delete(users).run()
  })

  describe("Namespaces 分区 CRUD 接口", () => {
    let createdNsId = ""

    it("POST: 能够创建新分区，并能写入 Agent 关联表", async () => {
      const payload = {
        name: "energy",
        displayName: "能源分区",
        description: "能耗管理背景知识",
        agentIds: ["energyAgent"],
      }

      const req = new Request("http://localhost/api/wiki/admin/namespaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const res = await postNamespace(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.id).toBeDefined()
      createdNsId = data.id

      // 验证 DB 是否有写入
      const [ns] = await db
        .select()
        .from(wikiNamespaces)
        .where(eq(wikiNamespaces.id, createdNsId))
        .all()
      expect(ns).toBeDefined()
      expect(ns.name).toBe("energy")

      const [binding] = await db
        .select()
        .from(agentWikiNamespaces)
        .where(eq(agentWikiNamespaces.namespaceId, createdNsId))
        .all()
      expect(binding).toBeDefined()
      expect(binding.agentId).toBe("energyAgent")
    })

    it("GET: 能够获取分区列表并带有绑定的 agent 列表", async () => {
      const res = await getNamespaces()
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe("energy")
      expect(data[0].agentIds).toContain("energyAgent")
    })

    it("PUT: 能够更新分区信息并更新 Agent 绑定关系", async () => {
      const payload = {
        displayName: "新版能源分区",
        description: "更新的能耗背景知识",
        agentIds: ["energyAgent", "anotherAgent"], // 增加绑定
      }

      const req = new Request(`http://localhost/api/wiki/admin/namespaces/${createdNsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const res = await putNamespace(req, { params: Promise.resolve({ id: createdNsId }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)

      // 检查 DB 中更新后的信息
      const [ns] = await db
        .select()
        .from(wikiNamespaces)
        .where(eq(wikiNamespaces.id, createdNsId))
        .all()
      expect(ns.displayName).toBe("新版能源分区")

      const bindings = await db
        .select()
        .from(agentWikiNamespaces)
        .where(eq(agentWikiNamespaces.namespaceId, createdNsId))
        .all()
      expect(bindings).toHaveLength(2)
      const agentIds = bindings.map((b) => b.agentId)
      expect(agentIds).toContain("energyAgent")
      expect(agentIds).toContain("anotherAgent")
    })

    it("DELETE: 能够删除分区，且级联删除绑定关系", async () => {
      const req = new Request(`http://localhost/api/wiki/admin/namespaces/${createdNsId}`, {
        method: "DELETE",
      })

      const res = await deleteNamespace(req, { params: Promise.resolve({ id: createdNsId }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)

      // 检查是否删除
      const ns = await db
        .select()
        .from(wikiNamespaces)
        .where(eq(wikiNamespaces.id, createdNsId))
        .get()
      expect(ns).toBeUndefined()

      const bindings = await db
        .select()
        .from(agentWikiNamespaces)
        .where(eq(agentWikiNamespaces.namespaceId, createdNsId))
        .all()
      expect(bindings).toHaveLength(0)
    })
  })

  describe("Operations 运营统计与反馈明细接口", () => {
    it("stats GET: 能够返回时间段内的统计指标和折线、Agent占比趋势数据", async () => {
      const req = new Request("http://localhost/api/admin/operations/stats?timeRange=30")
      const res = await getStats(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.summary).toBeDefined()
      expect(data.summary.totalMessages).toBe(1)
      expect(data.summary.totalFeedbacks).toBe(1)
      expect(data.summary.satisfactionRate).toBe(100)

      expect(data.trend).toBeDefined()
      expect(data.trend.length).toBeGreaterThan(0)

      expect(data.agentStats).toBeDefined()
      expect(data.agentStats[0].agentId).toBe("energyAgent")
      expect(data.agentStats[0].satisfactionRate).toBe(100)
    })

    it("feedbacks GET: 能够分页返回用户反馈细节，带有消息内容和会话标题", async () => {
      const req = new Request("http://localhost/api/admin/operations/feedbacks?page=1&limit=10")
      const res = await getFeedbacks(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.feedbacks).toHaveLength(1)
      expect(data.feedbacks[0].id).toBe("fb-1")
      expect(data.feedbacks[0].chatTitle).toBe("能源设备咨询")
      expect(data.feedbacks[0].type).toBe("up")
      expect(data.feedbacks[0].comment).toBe("很有帮助！")
      expect(data.feedbacks[0].displayName).toBe("测试用户")
      expect(data.feedbacks[0].messageContent).toContain("太阳能板发电效率很高。")
    })
  })
})
