/** API 请求体 Zod Schema 定义 */
import { z } from "zod"

/** 创建数据源 */
export const CreateDatasourceSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(200),
  description: z.string().max(1000).optional(),
  type: z.string().min(1, "类型不能为空"),
  auth: z.union([z.string(), z.record(z.unknown())]),
  config: z.union([z.string(), z.record(z.unknown())]),
  endpoints: z.union([z.string(), z.array(z.unknown())]).optional(),
  enabled: z.boolean().optional(),
})

/** 更新数据源 */
export const UpdateDatasourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  type: z.string().min(1).optional(),
  auth: z.union([z.string(), z.record(z.unknown())]).optional(),
  config: z.union([z.string(), z.record(z.unknown())]).optional(),
  endpoints: z.union([z.string(), z.array(z.unknown())]).optional(),
  enabled: z.boolean().optional(),
})

/** 创建对话 */
export const CreateChatSchema = z.object({
  title: z.string().max(500).optional(),
  agentId: z.string().max(100).optional(),
  modelId: z.string().max(200).nullable().optional(),
})

/** 更新对话 */
export const UpdateChatSchema = z.object({
  title: z.string().max(500).optional(),
  agentId: z.string().max(100).optional(),
  modelId: z.string().max(200).nullable().optional(),
})

/** 保存消息 — role 限定为 user/assistant，parts 限 100KB，忽略客户端 id */
export const CreateMessageSchema = z.object({
  role: z.enum(["user", "assistant"], {
    message: "role 必须为 user 或 assistant",
  }),
  parts: z
    .unknown()
    .refine(
      (val) => {
        const str = typeof val === "string" ? val : JSON.stringify(val)
        // 100KB 限制
        return new TextEncoder().encode(str).byteLength <= 102400
      },
      { message: "parts 大小不能超过 100KB" },
    ),
})

/** 新增提供商 */
export const CreateProviderSchema = z.object({
  id: z
    .string()
    .min(1, "ID 不能为空")
    .max(100)
    .regex(/^[a-z0-9_-]+$/, "ID 只能包含小写字母、数字、下划线和连字符"),
  name: z.string().min(1, "名称不能为空").max(200),
  type: z.enum(["cloud", "local"]).default("cloud"),
  apiFormat: z.enum(["openai", "anthropic", "google"]).default("openai"),
  baseUrl: z.string().url("baseUrl 必须为合法 URL").max(500),
  apiKey: z.string().max(500).optional(),
  apiKeyRequired: z.boolean().default(true),
  models: z.array(z.string().min(1).max(200)).max(100).optional(),
})
