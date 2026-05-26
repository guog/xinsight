import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { join } from "path"
import { mkdir, writeFile, rm } from "fs/promises"
import { db } from "@/db"
import { wikiNamespaces, agentWikiNamespaces } from "@/db/schema"
import { wikiSearchTool, wikiListTool } from "@/mastra/tools/wiki"
import { eq } from "drizzle-orm"

const tempWikiDir = join(process.cwd(), "wiki_test_temp")

beforeAll(async () => {
  // 设置临时 WIKI_PATH
  process.env.WIKI_PATH = tempWikiDir

  // 创建物理测试 wiki 文件结构
  await mkdir(tempWikiDir, { recursive: true })
  await mkdir(join(tempWikiDir, "energy"), { recursive: true })
  await mkdir(join(tempWikiDir, "warehouse"), { recursive: true })
  await mkdir(join(tempWikiDir, "entities"), { recursive: true })

  // 写入测试文件
  await writeFile(join(tempWikiDir, "index.md"), "# 全局索引\n- [公共](public.md)\n")
  await writeFile(
    join(tempWikiDir, "public.md"),
    "---\ntitle: 公共文档\ntype: note\n---\n这是公共的工厂简介文档。 关键词: 工厂",
  )
  await writeFile(
    join(tempWikiDir, "entities", "boiler.md"),
    "---\ntitle: 锅炉设备\ntype: entity\n---\n这是公共的锅炉设备。 关键词: 锅炉",
  )
  await writeFile(join(tempWikiDir, "energy", "index.md"), "# 能源索引\n- [太阳能](solar.md)\n")
  await writeFile(
    join(tempWikiDir, "energy", "solar.md"),
    "---\ntitle: 太阳能发电\ntype: energy\n---\n这是能源分区的太阳能。 关键词: 太阳能 能源",
  )
  await writeFile(
    join(tempWikiDir, "warehouse", "inventory.md"),
    "---\ntitle: 库存清单\ntype: warehouse\n---\n这是仓储分区的库存。 关键词: 库存 仓储",
  )

  // 内存 DB 插入分区和绑定数据
  await db
    .insert(wikiNamespaces)
    .values([
      {
        id: "ns-energy",
        name: "energy",
        displayName: "能源分区",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ns-warehouse",
        name: "warehouse",
        displayName: "仓储分区",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .run()

  await db
    .insert(agentWikiNamespaces)
    .values([
      { agentId: "energyAgent", namespaceId: "ns-energy", createdAt: new Date() },
      { agentId: "warehouseAgent", namespaceId: "ns-warehouse", createdAt: new Date() },
    ])
    .run()
})

afterAll(async () => {
  // 清理临时文件目录
  await rm(tempWikiDir, { recursive: true, force: true }).catch(() => {})
  // 清理内存 DB 数据
  await db.delete(agentWikiNamespaces).run()
  await db.delete(wikiNamespaces).run()
})

describe("wiki-search 和 wiki-list 工具的分区隔离性测试", () => {
  describe("wikiSearchTool", () => {
    it("通用（无 agentId）时：允许检索全部内容，包括各个分区", async () => {
      const res = await wikiSearchTool.execute({ query: "关键词", limit: 10 }, {} as any)
      expect(res.results.length).toBeGreaterThanOrEqual(3)
      const paths = res.results.map((r) => r.path)
      expect(paths).toContain("public.md")
      expect(paths).toContain("energy/solar.md")
      expect(paths).toContain("warehouse/inventory.md")
    })

    it("有 agentId 且绑定了分区 (energyAgent) 时：严格只搜索绑定的分区内容", async () => {
      const res = await wikiSearchTool.execute({ query: "关键词", limit: 10 }, {
        agentId: "energyAgent",
      } as any)
      // 应该只有 energy 分区下的 solar.md
      expect(res.results).toHaveLength(1)
      expect(res.results[0].path).toBe("energy/solar.md")
    })

    it("有 agentId 且绑定了分区 (warehouseAgent) 时：严格只搜索绑定的分区内容", async () => {
      const res = await wikiSearchTool.execute({ query: "关键词", limit: 10 }, {
        agent: { agentId: "warehouseAgent" },
      } as any)
      // 应该只有 warehouse 分区下的 inventory.md
      expect(res.results).toHaveLength(1)
      expect(res.results[0].path).toBe("warehouse/inventory.md")
    })

    it("有 agentId 但未绑定任何分区 (guestAgent) 时：只能搜索公共非分区文档", async () => {
      const res = await wikiSearchTool.execute({ query: "关键词", limit: 10 }, {
        agentId: "guestAgent",
      } as any)
      // 应该能搜到 public.md 和 entities/boiler.md，但绝对搜不到分区文档
      const paths = res.results.map((r) => r.path)
      expect(paths).toContain("public.md")
      expect(paths).toContain("entities/boiler.md")
      expect(paths).not.toContain("energy/solar.md")
      expect(paths).not.toContain("warehouse/inventory.md")
    })
  })

  describe("wikiListTool", () => {
    it("无 agentId 时：默认返回全局 index.md", async () => {
      const res = await wikiListTool.execute({}, {} as any)
      expect(res.success).toBe(true)
      expect(res.content).toContain("# 全局索引")
      expect(res.content).toContain("public.md")
    })

    it("有 agentId 且绑定分区 (energyAgent) 时：返回该分区的 index.md", async () => {
      const res = await wikiListTool.execute({}, { agentId: "energyAgent" } as any)
      expect(res.success).toBe(true)
      expect(res.content).toContain("# 能源索引")
      expect(res.content).toContain("solar.md")
      expect(res.content).not.toContain("库存")
    })

    it("有 agentId 且绑定分区，但无 index.md 时：应能动态扫描并生成目录列表", async () => {
      const res = await wikiListTool.execute({}, { agentId: "warehouseAgent" } as any)
      expect(res.success).toBe(true)
      expect(res.content).toContain("# warehouse 分区文档目录")
      expect(res.content).toContain("inventory.md")
    })

    it("有 agentId 但未绑定任何分区时：只列出公共非分区文档目录", async () => {
      const res = await wikiListTool.execute({}, { agentId: "guestAgent" } as any)
      expect(res.success).toBe(true)
      expect(res.content).toContain("# 公共文档目录")
      expect(res.content).toContain("public.md")
      expect(res.content).toContain("entities/boiler.md")
      expect(res.content).not.toContain("energy/solar.md")
    })
  })
})
