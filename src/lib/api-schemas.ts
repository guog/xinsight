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
