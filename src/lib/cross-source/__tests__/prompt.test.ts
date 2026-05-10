import { describe, test, expect } from "vitest"
import { CROSS_SOURCE_PROMPT } from "@/lib/cross-source/prompt"

describe("cross-source prompt", () => {
  test("导出非空字符串", () => {
    expect(CROSS_SOURCE_PROMPT).toBeTruthy()
    expect(typeof CROSS_SOURCE_PROMPT).toBe("string")
  })

  test("包含跨源关键指引", () => {
    expect(CROSS_SOURCE_PROMPT).toContain("多个数据源")
    expect(CROSS_SOURCE_PROMPT).toContain("关联分析")
    expect(CROSS_SOURCE_PROMPT).toContain("datasource-list")
    expect(CROSS_SOURCE_PROMPT).toContain("datasource-query")
  })

  test("包含顺序依赖说明", () => {
    expect(CROSS_SOURCE_PROMPT).toContain("先后依赖")
  })

  test("包含容错说明", () => {
    expect(CROSS_SOURCE_PROMPT).toContain("查询失败")
  })
})
