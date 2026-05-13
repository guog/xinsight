import type { GraphqlEndpoint, FieldDefinition } from "@/mastra/tools/datasource/types"

/** GraphQL 自省类型引用 */
export interface IntrospectionTypeRef {
  name: string
  kind: string
  ofType?: IntrospectionTypeRef | null
  fields?: IntrospectionField[] | null
}

/** GraphQL 自省字段参数 */
interface IntrospectionArg {
  name: string
  type: IntrospectionTypeRef
  defaultValue?: string | null
}

/** GraphQL 自省字段 */
interface IntrospectionField {
  name: string
  description?: string | null
  args: IntrospectionArg[]
  type: IntrospectionTypeRef
}

/** GraphQL 自省类型 */
export interface IntrospectionType {
  name: string
  kind: string
  fields?: IntrospectionField[] | null
}

/** GraphQL 自省结果 */
export interface IntrospectionResult {
  queries: GraphqlEndpoint[]
  mutations: GraphqlEndpoint[]
  subscriptions: GraphqlEndpoint[]
}

/** 标准自省查询 */
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        name
        kind
        fields {
          name
          description
          args {
            name
            type { name kind ofType { name kind ofType { name kind } } }
            defaultValue
          }
          type { name kind ofType { name kind ofType { name kind fields { name type { name kind } } } } }
        }
      }
    }
  }
`

/** 将自省类型引用格式化为 GraphQL 类型字符串 */
function formatTypeName(typeRef: IntrospectionTypeRef | null | undefined): string {
  if (!typeRef) return "String"
  if (typeRef.kind === "NON_NULL") return `${formatTypeName(typeRef.ofType)}!`
  if (typeRef.kind === "LIST") return `[${formatTypeName(typeRef.ofType)}]`
  return typeRef.name || "String"
}

/** 获取类型的标量字段名列表（用于生成返回字段） */
function getScalarFields(
  typeRef: IntrospectionTypeRef | null | undefined,
  allTypes: IntrospectionType[],
): string[] {
  const typeName =
    typeRef?.kind === "NON_NULL" || typeRef?.kind === "LIST"
      ? (typeRef?.ofType?.name ?? typeRef?.ofType?.ofType?.name)
      : typeRef?.name

  if (!typeName) return []

  const typeObj = allTypes.find((t) => t.name === typeName)
  if (!typeObj?.fields) return []

  return typeObj.fields
    .filter((f) => {
      const ft = f.type
      const kind = ft?.kind === "NON_NULL" ? ft?.ofType?.kind : ft?.kind
      return kind === "SCALAR" || kind === "ENUM"
    })
    .map((f) => f.name)
}

/** 为一个 field 生成简单查询字符串 */
function generateQuery(
  operationType: "query" | "mutation" | "subscription",
  field: IntrospectionField,
  allTypes: IntrospectionType[],
): string {
  const args = field.args ?? []
  const argsDef =
    args.length > 0
      ? `(${args.map((a) => `$${a.name}: ${formatTypeName(a.type)}`).join(", ")})`
      : ""
  const argsPass = args.length > 0 ? `(${args.map((a) => `${a.name}: $${a.name}`).join(", ")})` : ""

  const scalarFields = getScalarFields(field.type, allTypes)
  const selection = scalarFields.length > 0 ? ` {\n    ${scalarFields.join("\n    ")}\n  }` : ""

  return `${operationType}${argsDef} {\n  ${field.name}${argsPass}${selection}\n}`
}

/** 将 GraphQL 自省类型转换为 FieldDefinition[] */
export function graphqlTypeToFields(
  type: IntrospectionTypeRef | null | undefined,
  typeMap: Map<string, IntrospectionType>,
  maxDepth = 3,
  depth = 0,
): FieldDefinition[] {
  if (!type || depth >= maxDepth) return []

  if (type.kind === "NON_NULL") {
    return graphqlTypeToFields(type.ofType, typeMap, maxDepth, depth)
  }

  if (type.kind === "LIST") {
    const children = graphqlTypeToFields(type.ofType, typeMap, maxDepth, depth + 1)
    return [{ name: "items", type: "array", children }]
  }

  if (type.kind === "SCALAR") {
    const scalarMap: Record<string, FieldDefinition["type"]> = {
      String: "string",
      Int: "number",
      Float: "number",
      Boolean: "boolean",
      ID: "string",
    }
    return [{ name: type.name, type: scalarMap[type.name!] ?? "string" }]
  }

  if (type.kind === "OBJECT" || type.kind === "INTERFACE") {
    const resolved = typeMap.get(type.name)
    if (!resolved?.fields) return []
    return resolved.fields.map((f) => {
      const fieldType = unwrapType(f.type)
      const kind = fieldType?.kind
      if (!fieldType) {
        return { name: f.name, type: "string" as const, description: f.description || undefined }
      }
      if (kind === "SCALAR") {
        const scalarMap: Record<string, FieldDefinition["type"]> = {
          String: "string",
          Int: "number",
          Float: "number",
          Boolean: "boolean",
          ID: "string",
        }
        return {
          name: f.name,
          type: scalarMap[fieldType.name] ?? "string",
          description: f.description || undefined,
        }
      }
      if (kind === "OBJECT" || kind === "INTERFACE") {
        const children =
          depth + 1 < maxDepth ? graphqlTypeToFields(fieldType, typeMap, maxDepth, depth + 1) : []
        return {
          name: f.name,
          type: "object" as const,
          children,
          description: f.description || undefined,
        }
      }
      if (kind === "LIST") {
        const children = graphqlTypeToFields(
          f.type.ofType ?? fieldType.ofType,
          typeMap,
          maxDepth,
          depth + 1,
        )
        return {
          name: f.name,
          type: "array" as const,
          children,
          description: f.description || undefined,
        }
      }
      return { name: f.name, type: "string" as const, description: f.description || undefined }
    })
  }

  return []
}

/** 剥离 NON_NULL/LIST 包装获取底层类型 */
function unwrapType(typeRef: IntrospectionTypeRef | null | undefined): IntrospectionTypeRef | null {
  if (!typeRef) return null
  if (typeRef.kind === "NON_NULL" || typeRef.kind === "LIST") return unwrapType(typeRef.ofType)
  return typeRef
}

/** 为一个 field 生成 variables schema JSON */
function generateVariables(field: IntrospectionField): string | undefined {
  const args = field.args ?? []
  if (args.length === 0) return undefined
  const schema: Record<string, string> = {}
  for (const arg of args) {
    schema[arg.name] = formatTypeName(arg.type)
  }
  return JSON.stringify(schema)
}

/** 将一个根类型的 field 转换为 GraphqlEndpoint */
function fieldToEndpoint(
  field: IntrospectionField,
  operationType: "query" | "mutation" | "subscription",
  allTypes: IntrospectionType[],
  typeMap: Map<string, IntrospectionType>,
): GraphqlEndpoint {
  const responseFields = graphqlTypeToFields(field.type, typeMap)
  return {
    id: field.name,
    name: field.name,
    operationType,
    operationName: field.name,
    query: generateQuery(operationType, field, allTypes),
    variables: generateVariables(field),
    description: field.description ?? undefined,
    apiSchemaFormat: "openapi",
    responseSchema:
      responseFields.length > 0
        ? {
            fields: responseFields,
            source: "introspection",
            discoveredAt: new Date().toISOString(),
          }
        : undefined,
  }
}

/**
 * 对 GraphQL endpoint 执行自省查询，返回可用操作列表
 */
export async function introspectGraphql(
  endpoint: string,
  headers?: Record<string, string>,
): Promise<IntrospectionResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ query: INTROSPECTION_QUERY }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL 自省请求失败: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const schema = json?.data?.__schema

  if (!schema) {
    throw new Error("无效的 GraphQL 自省响应: 缺少 __schema")
  }

  const allTypes: IntrospectionType[] = schema.types ?? []
  const typeMap = new Map<string, IntrospectionType>()
  for (const t of allTypes) {
    if (t.name) typeMap.set(t.name, t)
  }

  function extractEndpoints(
    rootTypeName: string | null | undefined,
    opType: "query" | "mutation" | "subscription",
  ): GraphqlEndpoint[] {
    if (!rootTypeName) return []
    const rootType = allTypes.find((t) => t.name === rootTypeName)
    if (!rootType?.fields) return []
    return rootType.fields.map((f) =>
      fieldToEndpoint(f as IntrospectionField, opType, allTypes, typeMap),
    )
  }

  return {
    queries: extractEndpoints(schema.queryType?.name, "query"),
    mutations: extractEndpoints(schema.mutationType?.name, "mutation"),
    subscriptions: extractEndpoints(schema.subscriptionType?.name, "subscription"),
  }
}
