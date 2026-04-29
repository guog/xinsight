import type { GraphqlEndpoint } from "@/mastra/tools/datasource/types"

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
function formatTypeName(typeRef: any): string {
  if (!typeRef) return "String"
  if (typeRef.kind === "NON_NULL") return `${formatTypeName(typeRef.ofType)}!`
  if (typeRef.kind === "LIST") return `[${formatTypeName(typeRef.ofType)}]`
  return typeRef.name || "String"
}

/** 获取类型的标量字段名列表（用于生成返回字段） */
function getScalarFields(typeRef: any, allTypes: any[]): string[] {
  const typeName = typeRef?.kind === "NON_NULL" || typeRef?.kind === "LIST"
    ? typeRef?.ofType?.name ?? typeRef?.ofType?.ofType?.name
    : typeRef?.name

  if (!typeName) return []

  const typeObj = allTypes.find((t: any) => t.name === typeName)
  if (!typeObj?.fields) return []

  return typeObj.fields
    .filter((f: any) => {
      const ft = f.type
      const kind = ft?.kind === "NON_NULL" ? ft?.ofType?.kind : ft?.kind
      return kind === "SCALAR" || kind === "ENUM"
    })
    .map((f: any) => f.name)
}

/** 为一个 field 生成简单查询字符串 */
function generateQuery(
  operationType: "query" | "mutation" | "subscription",
  field: any,
  allTypes: any[],
): string {
  const args = field.args ?? []
  const argsDef = args.length > 0
    ? `(${args.map((a: any) => `$${a.name}: ${formatTypeName(a.type)}`).join(", ")})`
    : ""
  const argsPass = args.length > 0
    ? `(${args.map((a: any) => `${a.name}: $${a.name}`).join(", ")})`
    : ""

  const scalarFields = getScalarFields(field.type, allTypes)
  const selection = scalarFields.length > 0
    ? ` {\n    ${scalarFields.join("\n    ")}\n  }`
    : ""

  return `${operationType}${argsDef} {\n  ${field.name}${argsPass}${selection}\n}`
}

/** 为一个 field 生成 variables schema JSON */
function generateVariables(field: any): string | undefined {
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
  field: any,
  operationType: "query" | "mutation" | "subscription",
  allTypes: any[],
): GraphqlEndpoint {
  return {
    id: field.name,
    name: field.name,
    operationType,
    operationName: field.name,
    query: generateQuery(operationType, field, allTypes),
    variables: generateVariables(field),
    description: field.description ?? undefined,
    apiSchemaFormat: "openapi",
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

  const allTypes: any[] = schema.types ?? []

  function extractEndpoints(
    rootTypeName: string | null | undefined,
    opType: "query" | "mutation" | "subscription",
  ): GraphqlEndpoint[] {
    if (!rootTypeName) return []
    const rootType = allTypes.find((t: any) => t.name === rootTypeName)
    if (!rootType?.fields) return []
    return rootType.fields.map((f: any) => fieldToEndpoint(f, opType, allTypes))
  }

  return {
    queries: extractEndpoints(schema.queryType?.name, "query"),
    mutations: extractEndpoints(schema.mutationType?.name, "mutation"),
    subscriptions: extractEndpoints(schema.subscriptionType?.name, "subscription"),
  }
}
