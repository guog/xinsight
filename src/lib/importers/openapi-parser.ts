import YAML from "yaml"
import type { RestEndpoint, FieldDefinition } from "@/mastra/tools/datasource/types"

export interface ParsedOpenApiResult {
  baseUrl?: string
  endpoints: RestEndpoint[]
  info: { title: string; version: string }
  authType?: "none" | "bearer" | "basic" | "apikey"
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const

/**
 * 解析 OpenAPI 3.x 规范，支持 URL、JSON 字符串、YAML 字符串或已解析对象
 */
export async function parseOpenApiSpec(
  input: string | Record<string, unknown>,
): Promise<ParsedOpenApiResult> {
  const spec = await resolveInput(input)

  // 验证是否为有效 OpenAPI 规范
  if (!spec.openapi && !spec.swagger) {
    throw new Error("不是有效的 OpenAPI 规范：缺少 openapi 或 swagger 字段")
  }

  const info = {
    title: ((spec.info as Record<string, unknown>)?.title as string) ?? "",
    version: ((spec.info as Record<string, unknown>)?.version as string) ?? "",
  }

  const baseUrl =
    ((spec.servers as Array<Record<string, unknown>>)?.[0]?.url as string) || undefined

  const endpoints = extractEndpoints(spec)
  const authType = detectAuthType(spec)

  return { baseUrl, endpoints, info, authType }
}

async function resolveInput(
  input: string | Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (typeof input !== "string") return input

  // URL 输入
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const res = await fetch(input)
    const text = await res.text()
    return parseText(text)
  }

  return parseText(input)
}

function parseText(text: string): Record<string, unknown> {
  // 先尝试 JSON
  try {
    return JSON.parse(text)
  } catch {
    // 再尝试 YAML
    try {
      const result = YAML.parse(text)
      if (result && typeof result === "object") return result
    } catch {
      // 都失败
    }
  }
  throw new Error("无法解析输入：既不是有效的 JSON 也不是有效的 YAML")
}

function extractEndpoints(spec: Record<string, unknown>): RestEndpoint[] {
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return []

  const endpoints: RestEndpoint[] = []

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as Record<string, unknown> | undefined
      if (!operation) continue

      const operationId = operation.operationId as string | undefined
      const summary = operation.summary as string | undefined
      const description = operation.description as string | undefined

      const id = operationId || `${method}-${path.replace(/\//g, "-")}`
      const name = summary || operationId || `${method.toUpperCase()} ${path}`

      // 提取 query 参数
      const parameters = operation.parameters as Array<Record<string, unknown>> | undefined
      const queryParams: Record<string, string> = {}
      if (parameters) {
        for (const param of parameters) {
          if (param.in === "query") {
            const schema = param.schema as Record<string, unknown> | undefined
            queryParams[param.name as string] = (schema?.type as string) || "string"
          }
        }
      }

      // 提取 requestBody
      const requestBody = operation.requestBody as Record<string, unknown> | undefined
      let requestBodyStr: string | undefined
      if (requestBody) {
        const content = requestBody.content as Record<string, Record<string, unknown>> | undefined
        const jsonContent = content?.["application/json"]
        if (jsonContent?.schema) {
          requestBodyStr = JSON.stringify(jsonContent.schema)
        }
      }

      // 提取 paramSchema（参数的 JSON Schema）
      let paramSchema: string | undefined
      if (parameters && parameters.length > 0) {
        paramSchema = JSON.stringify(parameters)
      }

      // 提取 responseExample
      let responseExample: string | undefined
      const responses = operation.responses as Record<string, Record<string, unknown>> | undefined
      const okResponse = responses?.["200"] || responses?.["201"]
      if (okResponse) {
        const content = okResponse.content as Record<string, Record<string, unknown>> | undefined
        const jsonContent = content?.["application/json"]
        if (jsonContent) {
          if (jsonContent.example) {
            responseExample = JSON.stringify(jsonContent.example)
          } else if (jsonContent.schema) {
            responseExample = JSON.stringify(jsonContent.schema)
          }
        }
      }

      // 提取 responseSchema
      let responseSchema: RestEndpoint["responseSchema"]
      if (okResponse) {
        const rsContent = okResponse.content as Record<string, Record<string, unknown>> | undefined
        const rsJsonContent = rsContent?.["application/json"]
        if (rsJsonContent?.schema) {
          const fields = openApiSchemaToFields(rsJsonContent.schema)
          if (fields.length > 0) {
            responseSchema = {
              fields,
              source: "openapi" as const,
              discoveredAt: new Date().toISOString(),
            }
          }
        }
      }

      endpoints.push({
        id,
        name,
        description,
        method: method.toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
        path,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        requestBody: requestBodyStr,
        paramSchema,
        apiSchemaFormat: "openapi",
        responseExample,
        responseSchema,
      })
    }
  }

  return endpoints
}

/** 将 OpenAPI JSON Schema 转换为 FieldDefinition 数组 */
export function openApiSchemaToFields(schema: unknown, maxDepth = 3): FieldDefinition[] {
  if (!schema || maxDepth <= 0 || schema.$ref) return []

  const mapType = (t: string): FieldDefinition["type"] => {
    if (t === "integer") return "number"
    if (["string", "number", "boolean", "object", "array", "null"].includes(t))
      return t as FieldDefinition["type"]
    return "string"
  }

  if (schema.type === "object" && schema.properties) {
    return Object.entries(schema.properties).map(
      ([name, prop]: [string, Record<string, unknown>]) => {
        const field: FieldDefinition = { name, type: mapType(prop.type || "string") }
        if (prop.description) field.description = prop.description
        if (prop.type === "object" && prop.properties) {
          field.children = openApiSchemaToFields(prop, maxDepth - 1)
        } else if (prop.type === "array" && prop.items) {
          field.children = prop.items.$ref ? [] : openApiSchemaToFields(prop.items, maxDepth - 1)
        }
        return field
      },
    )
  }

  if (schema.type === "array" && schema.items) {
    return openApiSchemaToFields(schema.items, maxDepth - 1)
  }

  return []
}

function detectAuthType(spec: Record<string, unknown>): ParsedOpenApiResult["authType"] {
  const components = spec.components as Record<string, unknown> | undefined
  const securitySchemes = components?.securitySchemes as
    | Record<string, Record<string, unknown>>
    | undefined
  if (!securitySchemes) return "none"

  for (const scheme of Object.values(securitySchemes)) {
    if (scheme.type === "http" && scheme.scheme === "bearer") return "bearer"
    if (scheme.type === "http" && scheme.scheme === "basic") return "basic"
    if (scheme.type === "apiKey") return "apikey"
  }

  return "none"
}
