import { z } from "zod"

/** 支持的适配器协议类型 */
export const AdapterType = z.enum(["rest", "graphql", "grpc", "opcua", "mqtt"])
export type AdapterType = z.infer<typeof AdapterType>

/** 认证配置 */
export const AuthConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("bearer"), token: z.string() }),
  z.object({ type: z.literal("basic"), username: z.string(), password: z.string() }),
  z.object({
    type: z.literal("apikey"),
    key: z.string(),
    value: z.string(),
    in: z.enum(["header", "query"]),
  }),
])
export type AuthConfig = z.infer<typeof AuthConfigSchema>

/** REST 适配器配置 */
export const RestConfigSchema = z.object({
  baseUrl: z.string().url(),
  defaultHeaders: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().optional(),
})

/** GraphQL 适配器配置 */
export const GraphqlConfigSchema = z.object({
  endpoint: z.string().url(),
  defaultHeaders: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().optional(),
})

/** API Schema 格式类型 — 自然语言描述 或 OpenAPI JSON Schema */
export const ApiSchemaFormat = z.enum(["natural", "openapi"]).default("natural")
export type ApiSchemaFormat = z.infer<typeof ApiSchemaFormat>

/** 数据源 Endpoint 定义 — 描述数据源能提供的接口 */
export const DatasourceEndpointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  params: z.record(z.string(), z.unknown()), // 调用时的默认参数模板 (path, method, query 等)
  paramSchema: z.string().optional(), // 入参说明 (自然语言描述 或 OpenAPI JSON Schema，由 apiSchemaFormat 决定)
  apiSchemaFormat: ApiSchemaFormat, // "natural" = 自然语言，"openapi" = 结构化 OpenAPI JSON Schema
  responseExample: z.string().optional(), // 响应示例
})
export type DatasourceEndpoint = z.infer<typeof DatasourceEndpointSchema>

/** 字段定义 Schema（递归） */
export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: z.enum(["string", "number", "boolean", "object", "array", "null"]),
    description: z.optional(z.string()),
    children: z.optional(z.array(FieldDefinitionSchema)),
  }),
)

export type FieldDefinition = {
  name: string
  type: "string" | "number" | "boolean" | "object" | "array" | "null"
  description?: string
  children?: FieldDefinition[]
}

/** 响应 Schema 定义 */
export const ResponseSchemaDefinition = z.object({
  fields: z.array(FieldDefinitionSchema),
  description: z.optional(z.string()),
  discoveredAt: z.optional(z.string()),
  source: z.optional(z.enum(["manual", "inferred", "openapi", "introspection"])),
})
export type ResponseSchema = z.infer<typeof ResponseSchemaDefinition>

/** 协议 endpoint 公共基础字段 */
const endpointBaseFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  paramSchema: z.string().optional(),
  apiSchemaFormat: ApiSchemaFormat,
  responseExample: z.string().optional(),
  responseSchema: z.optional(ResponseSchemaDefinition),
}

/** REST 协议 endpoint */
export const RestEndpointSchema = z.object({
  ...endpointBaseFields,
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  queryParams: z.record(z.string(), z.string()).optional(),
  requestBody: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})
export type RestEndpoint = z.infer<typeof RestEndpointSchema>

/** GraphQL 协议 endpoint */
export const GraphqlEndpointSchema = z.object({
  ...endpointBaseFields,
  operationType: z.enum(["query", "mutation", "subscription"]),
  operationName: z.string().min(1),
  query: z.string().min(1),
  variables: z.string().optional(),
})
export type GraphqlEndpoint = z.infer<typeof GraphqlEndpointSchema>

/** gRPC 协议 endpoint */
export const GrpcEndpointSchema = z.object({
  ...endpointBaseFields,
  service: z.string().min(1),
  method: z.string().min(1),
  requestMessage: z.string().optional(),
  responseMessage: z.string().optional(),
})
export type GrpcEndpoint = z.infer<typeof GrpcEndpointSchema>

/** OPC UA 协议 endpoint */
export const OpcuaEndpointSchema = z.object({
  ...endpointBaseFields,
  action: z.enum(["read", "write", "browse"]),
  nodeIds: z.array(z.string().min(1)),
  dataType: z.string().optional(),
})
export type OpcuaEndpoint = z.infer<typeof OpcuaEndpointSchema>

/** MQTT 协议 endpoint */
export const MqttEndpointSchema = z.object({
  ...endpointBaseFields,
  topic: z.string().min(1),
  direction: z.enum(["publish", "subscribe", "both"]),
  qos: z.number().min(0).max(2).default(0),
  payloadFormat: z.enum(["json", "text", "binary"]).default("json"),
})
export type MqttEndpoint = z.infer<typeof MqttEndpointSchema>

/** 协议 endpoint 联合类型 */
export type ProtocolEndpoint =
  | RestEndpoint
  | GraphqlEndpoint
  | GrpcEndpoint
  | OpcuaEndpoint
  | MqttEndpoint

/** 按适配器类型索引的 endpoint schema 映射 */
export const EndpointSchemaByType = {
  rest: RestEndpointSchema,
  graphql: GraphqlEndpointSchema,
  grpc: GrpcEndpointSchema,
  opcua: OpcuaEndpointSchema,
  mqtt: MqttEndpointSchema,
} as const

/** 数据源配置（完整） */
export const DatasourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: AdapterType,
  auth: AuthConfigSchema,
  config: z.record(z.string(), z.unknown()),
  endpoints: z.array(DatasourceEndpointSchema).default([]),
  enabled: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type DatasourceConfig = z.infer<typeof DatasourceConfigSchema>

/** 查询请求 */
export interface DatasourceQuery {
  datasourceId: string
  params: Record<string, unknown>
}

/** 查询响应 */
export interface DatasourceResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    duration: number
    datasourceId: string
    datasourceName: string
    truncated?: boolean
    [key: string]: unknown
  }
}

/** 适配器接口 */
export interface DatasourceAdapter {
  readonly type: AdapterType
  query(config: DatasourceConfig, params: Record<string, unknown>): Promise<DatasourceResult>
  testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }>
}
