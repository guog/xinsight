import YAML from "yaml"
import type {
  RestEndpoint,
  FieldDefinition,
  StructuredParam,
} from "@/mastra/tools/datasource/types"

export interface ParsedOpenApiResult {
  baseUrl?: string
  endpoints: RestEndpoint[]
  info: { title: string; version: string }
  authType?: "none" | "bearer" | "basic" | "apikey"
}

/** 解析选项 */
export interface ParseOpenApiOptions {
  /** 仅导入 GET（Read）操作，Phase 1 推荐 */
  readOnly?: boolean
  /** 允许的 HTTP 方法列表，优先级高于 readOnly */
  methods?: string[]
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const

/**
 * 解析 OpenAPI 3.x 规范，支持 URL、JSON 字符串、YAML 字符串或已解析对象
 */
export async function parseOpenApiSpec(
  input: string | Record<string, unknown>,
  options?: ParseOpenApiOptions,
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

  const endpoints = extractEndpoints(spec, options)
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

/** 从 OpenAPI operation 提取结构化参数 */
function extractStructuredParams(
  operation: Record<string, unknown>,
  path: string,
): StructuredParam[] {
  const params: StructuredParam[] = []

  // 1. Path 参数
  const pathParamNames = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1])

  // 2. Operation parameters (path + query + header)
  const parameters = operation.parameters as Array<Record<string, unknown>> | undefined
  if (parameters) {
    for (const param of parameters) {
      const schema = param.schema as Record<string, unknown> | undefined
      const paramType = mapOpenApiType(schema?.type as string)
      const sp: StructuredParam = {
        name: param.name as string,
        type: paramType,
        required: (param.required as boolean) ?? pathParamNames.includes(param.name as string),
        description: (param.description as string) ?? undefined,
      }
      if (schema?.default !== undefined) sp.default = schema.default
      if (schema?.enum) sp.enum = schema.enum as string[]
      if (schema?.example !== undefined) sp.example = schema.example
      if (schema?.format) sp.format = schema.format as string
      params.push(sp)
    }
  }

  // 3. RequestBody properties
  const requestBody = operation.requestBody as Record<string, unknown> | undefined
  if (requestBody) {
    const content = requestBody.content as Record<string, Record<string, unknown>> | undefined
    const jsonContent = content?.["application/json"]
    if (jsonContent?.schema) {
      const bodySchema = jsonContent.schema as Record<string, unknown>
      if (bodySchema.properties) {
        const required = (bodySchema.required as string[]) ?? []
        for (const [name, prop] of Object.entries(
          bodySchema.properties as Record<string, Record<string, unknown>>,
        )) {
          const paramType = mapOpenApiType(prop.type as string)
          const sp: StructuredParam = {
            name,
            type: paramType,
            required: required.includes(name),
            description: (prop.description as string) ?? undefined,
          }
          if (prop.default !== undefined) sp.default = prop.default
          if (prop.enum) sp.enum = prop.enum as string[]
          if (prop.example !== undefined) sp.example = prop.example
          if (prop.format) sp.format = prop.format as string
          params.push(sp)
        }
      }
    }
  }

  return params
}

function mapOpenApiType(type: string | undefined): StructuredParam["type"] {
  switch (type) {
    case "integer":
      return "number"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "array":
      return "array"
    case "object":
      return "object"
    default:
      return "string"
  }
}

/**
 * 解析 $ref 引用，支持 #/components/schemas/... 等本地引用
 * 不支持外部文件引用（$ref 指向其他文件）
 */
function resolveRef(spec: Record<string, unknown>, obj: unknown, depth = 0): unknown {
  if (!obj || typeof obj !== "object" || depth > 10) return obj

  const record = obj as Record<string, unknown>
  if (typeof record.$ref === "string") {
    const refPath = record.$ref
    if (!refPath.startsWith("#/")) return obj // 不支持外部引用

    const parts = refPath.slice(2).split("/")
    let current: unknown = spec
    for (const part of parts) {
      if (!current || typeof current !== "object") return obj
      current = (current as Record<string, unknown>)[part]
    }
    // 递归解析，防止嵌套 $ref
    return resolveRef(spec, current, depth + 1)
  }

  return obj
}

/**
 * 深度解析对象中所有 $ref 引用
 */
function deepResolveRefs(spec: Record<string, unknown>, obj: unknown, depth = 0): unknown {
  if (!obj || typeof obj !== "object" || depth > 8) return obj

  const record = obj as Record<string, unknown>
  // 先解析顶层 $ref
  const resolved = resolveRef(spec, record, 0)
  if (resolved !== record) {
    return deepResolveRefs(spec, resolved, depth + 1)
  }

  if (Array.isArray(record)) {
    return record.map((item) => deepResolveRefs(spec, item, depth + 1))
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    result[key] = deepResolveRefs(spec, value, depth + 1)
  }
  return result
}

/**
 * 合并 path 级别和 operation 级别的 parameters（operation 级别优先）
 */
function mergeParameters(
  pathParams?: Array<Record<string, unknown>> | undefined,
  operationParams?: Array<Record<string, unknown>> | undefined,
): Array<Record<string, unknown>> {
  if (!pathParams) return operationParams ?? []
  if (!operationParams) return pathParams

  // operation 级别参数覆盖 path 级别同名参数
  const opParamKeys = new Set(operationParams.map((p) => `${p.in}:${p.name}`))
  const merged = [...operationParams]
  for (const p of pathParams) {
    if (!opParamKeys.has(`${p.in}:${p.name}`)) {
      merged.push(p)
    }
  }
  return merged
}

function extractEndpoints(
  spec: Record<string, unknown>,
  options?: ParseOpenApiOptions,
): RestEndpoint[] {
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return []

  // 确定允许的方法
  const allowedMethods = options?.methods
    ? options.methods.map((m) => m.toLowerCase())
    : options?.readOnly
      ? ["get"]
      : HTTP_METHODS.slice()

  const endpoints: RestEndpoint[] = []

  for (const [path, pathItem] of Object.entries(paths)) {
    // 合并 path 级别的 parameters
    const pathParams = pathItem.parameters as Array<Record<string, unknown>> | undefined

    for (const method of HTTP_METHODS) {
      if (!allowedMethods.includes(method)) continue

      const operation = pathItem[method] as Record<string, unknown> | undefined
      if (!operation) continue

      const operationId = operation.operationId as string | undefined
      const summary = operation.summary as string | undefined
      const description = operation.description as string | undefined

      const id = operationId || `${method}-${path.replace(/\//g, "-")}`
      const name = summary || operationId || `${method.toUpperCase()} ${path}`

      // 提取 query 参数（合并 path 级别和 operation 级别参数）
      const operationParams = operation.parameters as Array<Record<string, unknown>> | undefined
      const mergedParams = mergeParameters(pathParams, operationParams)
      const parameters = mergedParams.map((p) => resolveRef(spec, p) as Record<string, unknown>)
      const queryParams: Record<string, string> = {}
      if (parameters) {
        for (const param of parameters) {
          if (param.in === "query") {
            const schema = param.schema as Record<string, unknown> | undefined
            queryParams[param.name as string] = (schema?.type as string) || "string"
          }
        }
      }

      // 提取 requestBody（解析 $ref）
      const requestBody = deepResolveRefs(spec, operation.requestBody) as
        | Record<string, unknown>
        | undefined
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

      // 提取 responseExample（解析 $ref）
      let responseExample: string | undefined
      const responses = deepResolveRefs(spec, operation.responses) as
        | Record<string, Record<string, unknown>>
        | undefined
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

      const structuredParams = extractStructuredParams(operation, path)

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
        structuredParams: structuredParams.length > 0 ? structuredParams : undefined,
      })
    }
  }

  return endpoints
}

/** OpenAPI Schema 对象类型 */
interface OpenApiSchemaObject {
  $ref?: string
  type?: string
  properties?: Record<string, OpenApiSchemaObject>
  items?: OpenApiSchemaObject
  description?: string
  [key: string]: unknown
}

/** 将 OpenAPI JSON Schema 转换为 FieldDefinition 数组 */
export function openApiSchemaToFields(schema: unknown, maxDepth = 3): FieldDefinition[] {
  const s = schema as OpenApiSchemaObject | null | undefined
  if (!s || maxDepth <= 0 || s.$ref) return []

  const mapType = (t: string): FieldDefinition["type"] => {
    if (t === "integer") return "number"
    if (["string", "number", "boolean", "object", "array", "null"].includes(t))
      return t as FieldDefinition["type"]
    return "string"
  }

  if (s.type === "object" && s.properties) {
    return Object.entries(s.properties).map(([name, prop]) => {
      const field: FieldDefinition = { name, type: mapType(prop.type || "string") }
      if (prop.description) field.description = prop.description
      if (prop.type === "object" && prop.properties) {
        field.children = openApiSchemaToFields(prop, maxDepth - 1)
      } else if (prop.type === "array" && prop.items) {
        field.children = prop.items.$ref ? [] : openApiSchemaToFields(prop.items, maxDepth - 1)
      }
      return field
    })
  }

  if (s.type === "array" && s.items) {
    return openApiSchemaToFields(s.items, maxDepth - 1)
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
