/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { writeFile, mkdir, rm } from "fs/promises"
import { join } from "path"
import { wikiSearchTool, wikiReadTool, wikiIngestTool } from "../index"

const TEST_WIKI = join(process.cwd(), "wiki-test-temp")

// 设置测试用环境变量
process.env.WIKI_PATH = TEST_WIKI

describe("wiki tools", () => {
  beforeEach(async () => {
    await mkdir(join(TEST_WIKI, "entities"), { recursive: true })
    await mkdir(join(TEST_WIKI, "concepts"), { recursive: true })
    await mkdir(join(TEST_WIKI, "raw/uploads"), { recursive: true })

    // 创建测试页面
    await writeFile(
      join(TEST_WIKI, "entities/plc-controller.md"),
      `---
title: PLC 控制器
created: 2024-01-01
updated: 2024-01-15
type: entity
tags: [equipment, plc]
sources: [raw/uploads/设备清单.csv]
---

# PLC 控制器

可编程逻辑控制器，用于自动化产线控制。

## 型号
- Siemens S7-1500
- Allen Bradley CompactLogix

## 关联
- [[production-line]]
- [[scada-system]]
`,
    )

    await writeFile(
      join(TEST_WIKI, "concepts/oee-metric.md"),
      `---
title: OEE 指标
created: 2024-01-05
updated: 2024-01-10
type: concept
tags: [metric, kpi]
sources: [raw/uploads/指标定义.md]
---

# OEE (Overall Equipment Effectiveness)

设备综合效率 = 可用率 × 性能率 × 良品率

## 计算公式
- 可用率 = 实际运行时间 / 计划运行时间
- 性能率 = 实际产量 / 理论产量
- 良品率 = 良品数 / 总产量

## 关联
- [[plc-controller]]
- [[production-line]]
`,
    )
  })

  afterEach(async () => {
    await rm(TEST_WIKI, { recursive: true, force: true })
  })

  describe("wiki-search", () => {
    test("tool 元信息正确", () => {
      expect(wikiSearchTool.id).toBe("wiki-search")
    })

    test("按关键词搜索到页面", async () => {
      const result = await (wikiSearchTool as any).execute({ query: "PLC 控制器", limit: 5 }, {})

      expect(result.results.length).toBeGreaterThan(0)
      expect(result.results[0].title).toBe("PLC 控制器")
      expect(result.results[0].path).toContain("plc-controller.md")
    })

    test("搜索 OEE 找到概念页面", async () => {
      const result = await (wikiSearchTool as any).execute({ query: "OEE 设备效率", limit: 5 }, {})

      expect(result.results.length).toBeGreaterThan(0)
      expect(result.results.some((r: { title: string }) => r.title === "OEE 指标")).toBe(true)
    })

    test("搜索不存在的内容返回空", async () => {
      const result = await (wikiSearchTool as any).execute(
        { query: "zzz不存在的内容xyz", limit: 5 },
        {},
      )

      expect(result.results).toHaveLength(0)
    })

    test("按类型过滤搜索", async () => {
      const result = await (wikiSearchTool as any).execute(
        { query: "PLC", type: "concept", limit: 5 },
        {},
      )

      // PLC 是 entity 类型，搜索 concept 不应找到它（除非概念页中提及）
      const hasPlcEntity = result.results.some((r: { path: string }) =>
        r.path.includes("plc-controller"),
      )
      expect(hasPlcEntity).toBe(false)
    })
  })

  describe("wiki-read", () => {
    test("读取存在的页面", async () => {
      const result = await (wikiReadTool as any).execute({ path: "entities/plc-controller.md" }, {})

      expect(result.success).toBe(true)
      expect(result.content).toContain("PLC 控制器")
      expect(result.content).toContain("Siemens S7-1500")
    })

    test("读取不存在的页面返回错误", async () => {
      const result = await (wikiReadTool as any).execute({ path: "entities/nonexistent.md" }, {})

      expect(result.success).toBe(false)
      expect(result.error).toContain("不存在")
    })

    test("路径遍历被拒绝", async () => {
      const result = await (wikiReadTool as any).execute({ path: "../../etc/passwd" }, {})

      expect(result.success).toBe(false)
    })
  })

  describe("wiki-ingest", () => {
    test("创建新 wiki 页面", async () => {
      // 先创建 index.md 和 log.md
      await writeFile(join(TEST_WIKI, "index.md"), "# Index\n\n## Entities\n")
      await writeFile(join(TEST_WIKI, "log.md"), "# Log\n")

      const result = await (wikiIngestTool as any).execute(
        {
          filePath: "raw/uploads/test.csv",
          pages: [
            {
              path: "entities/new-device.md",
              content: "---\ntitle: 新设备\n---\n\n# 新设备\n\n描述内容",
            },
          ],
          indexEntries: ["- [[new-device]] — 新设备描述"],
          logEntry: "## [2024-01-20] ingest | test.csv",
        },
        {},
      )

      expect(result.success).toBe(true)
      expect(result.pagesCreated).toBe(1)
      expect(result.pagesUpdated).toBe(0)
    })

    test("更新已有页面", async () => {
      await writeFile(join(TEST_WIKI, "index.md"), "# Index\n")
      await writeFile(join(TEST_WIKI, "log.md"), "# Log\n")

      const result = await (wikiIngestTool as any).execute(
        {
          filePath: "raw/uploads/update.md",
          pages: [
            {
              path: "entities/plc-controller.md",
              content: "---\ntitle: PLC 控制器（更新版）\n---\n\n# 更新内容",
            },
          ],
        },
        {},
      )

      expect(result.success).toBe(true)
      expect(result.pagesCreated).toBe(0)
      expect(result.pagesUpdated).toBe(1)
    })
  })
})
