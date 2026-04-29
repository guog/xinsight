import { describe, expect, test } from "bun:test"
import { inferSchema } from "./infer-schema"

describe("inferSchema", () => {
  test("simple flat object", () => {
    const result = inferSchema({ name: "foo", age: 1, active: true })
    expect(result).toEqual([
      { name: "name", type: "string" },
      { name: "age", type: "number" },
      { name: "active", type: "boolean" },
    ])
  })

  test("nested object", () => {
    const result = inferSchema({ user: { name: "x", address: { city: "y" } } })
    expect(result).toEqual([
      {
        name: "user",
        type: "object",
        children: [
          { name: "name", type: "string" },
          {
            name: "address",
            type: "object",
            children: [{ name: "city", type: "string" }],
          },
        ],
      },
    ])
  })

  test("array input", () => {
    const result = inferSchema([{ id: 1, name: "x" }])
    expect(result).toEqual([
      { name: "id", type: "number" },
      { name: "name", type: "string" },
    ])
  })

  test("maxDepth respected", () => {
    const data = { a: { b: { c: { d: "deep" } } } }
    const result = inferSchema(data, 3)
    // depth 1: a->object, depth 2: b->object, depth 3: c->object (no children since maxDepth exhausted)
    expect(result).toEqual([
      {
        name: "a",
        type: "object",
        children: [
          {
            name: "b",
            type: "object",
            children: [{ name: "c", type: "object" }],
          },
        ],
      },
    ])
  })

  test("empty/null/primitive inputs return []", () => {
    expect(inferSchema(null)).toEqual([])
    expect(inferSchema(undefined)).toEqual([])
    expect(inferSchema(42)).toEqual([])
    expect(inferSchema("hello")).toEqual([])
    expect(inferSchema([])).toEqual([])
  })
})
