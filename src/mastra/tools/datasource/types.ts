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
  }
}

/** 适配器接口 */
export interface DatasourceAdapter {
  readonly type: AdapterType
  query(config: DatasourceConfig, params: Record<string, unknown>): Promise<DatasourceResult>
  testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }>
}
