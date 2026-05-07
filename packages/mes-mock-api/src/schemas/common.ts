import { z } from "zod"

// 通用列表响应包装器
export function listResponse<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    data: z.array(schema),
  })
}

// 通用单项响应包装器
export function itemResponse<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    data: schema,
  })
}

// 错误响应
export const ErrorResponse = z.object({
  error: z.string(),
})
