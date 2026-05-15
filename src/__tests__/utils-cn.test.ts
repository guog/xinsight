import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn 工具函数", () => {
  it("合并单个类名", () => {
    expect(cn("px-4")).toBe("px-4")
  })

  it("合并多个类名", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2")
  })

  it("tailwind 冲突时后者优先", () => {
    expect(cn("px-4", "px-8")).toBe("px-8")
  })

  it("条件类名", () => {
    expect(cn("base", false && "hidden", true && "visible")).toBe("base visible")
  })

  it("undefined 和 null 被忽略", () => {
    expect(cn("base", undefined, null)).toBe("base")
  })

  it("空字符串", () => {
    expect(cn("")).toBe("")
  })
})
