import { describe, it, expect } from "vitest"
import { datasourceQueryTool, datasourceListTool } from "../index"

describe("datasource tools", () => {
  describe("datasourceQueryTool", () => {
    it("id 应为 datasource-query", () => {
      expect(datasourceQueryTool.id).toBe("datasource-query")
    })

    it("应有描述信息", () => {
      expect(datasourceQueryTool.description).toBeTruthy()
      expect(datasourceQueryTool.description).toContain("数据源")
    })

    it("应定义 inputSchema 和 outputSchema", () => {
      expect(datasourceQueryTool.inputSchema).toBeDefined()
      expect(datasourceQueryTool.outputSchema).toBeDefined()
    })
  })

  describe("datasourceListTool", () => {
    it("id 应为 datasource-list", () => {
      expect(datasourceListTool.id).toBe("datasource-list")
    })

    it("应有描述信息", () => {
      expect(datasourceListTool.description).toBeTruthy()
      expect(datasourceListTool.description).toContain("数据源")
    })

    it("应定义 inputSchema 和 outputSchema", () => {
      expect(datasourceListTool.inputSchema).toBeDefined()
      expect(datasourceListTool.outputSchema).toBeDefined()
    })
  })
})
