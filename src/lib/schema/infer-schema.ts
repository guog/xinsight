import type { FieldDefinition } from "../../mastra/tools/datasource/types"

export function inferSchema(data: unknown, maxDepth = 3): FieldDefinition[] {
  if (Array.isArray(data)) {
    if (data.length === 0) return []
    return inferSchema(data[0], maxDepth)
  }

  if (data === null || typeof data !== "object") return []

  return Object.entries(data as Record<string, unknown>).map(([key, value]): FieldDefinition => {
    if (value === null) return { name: key, type: "null" }
    if (Array.isArray(value)) {
      if (value.length === 0 || maxDepth <= 1) return { name: key, type: "array" }
      const children = inferSchema(value[0], maxDepth - 1)
      return { name: key, type: "array", children }
    }
    if (typeof value === "object") {
      if (maxDepth <= 1) return { name: key, type: "object" }
      const children = inferSchema(value, maxDepth - 1)
      return { name: key, type: "object", children }
    }
    const t = typeof value as "string" | "number" | "boolean"
    return { name: key, type: t }
  })
}
