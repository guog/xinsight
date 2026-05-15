import { describe, it, expect } from "vitest"
import { inferSchema } from "@/lib/schema/infer-schema"

describe("inferSchema 补充覆盖", () => {
  it("null 值字段推断为 null 类型", () => {
    const result = inferSchema({ x: null, y: "hello" })
    expect(result).toContainEqual({ name: "x", type: "null" })
  })

  it("空数组字段推断为 array（无 children）", () => {
    const result = inferSchema({ items: [] })
    expect(result).toEqual([{ name: "items", type: "array" }])
  })

  it("数组字段 maxDepth=1 不展开", () => {
    const result = inferSchema({ items: [{ id: 1 }] }, 1)
    expect(result).toEqual([{ name: "items", type: "array" }])
  })

  it("嵌套数组递归推断 children", () => {
    const result = inferSchema({ items: [{ name: "a", count: 1 }] })
    expect(result).toEqual([
      {
        name: "items",
        type: "array",
        children: [
          { name: "name", type: "string" },
          { name: "count", type: "number" },
        ],
      },
    ])
  })
})
