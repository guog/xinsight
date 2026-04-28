import { describe, it, expect } from "vitest"
import { weatherTool } from "./weather"

describe("weatherTool", () => {
  it("应该正确定义工具基本属性", () => {
    expect(weatherTool).toBeDefined()
    expect(weatherTool.id).toBe("weather")
  })
})
