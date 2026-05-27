import type { StructuredParam } from "./types"

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/** 校验用户参数是否符合结构化参数定义 */
export function validateParams(
  structuredParams: StructuredParam[],
  userParams: Record<string, unknown>,
): ValidationResult {
  const errors: string[] = []

  for (const sp of structuredParams) {
    const value = userParams[sp.name]

    // 必填检查
    if (sp.required && (value === undefined || value === null || value === "")) {
      errors.push(`参数 '${sp.name}' 为必填项${sp.description ? `（${sp.description}）` : ""}`)
      continue
    }

    if (value === undefined || value === null) continue

    // 类型检查
    switch (sp.type) {
      case "number": {
        const num = Number(value)
        if (isNaN(num)) {
          errors.push(`参数 '${sp.name}' 应为数字类型，当前值: ${String(value)}`)
        }
        break
      }
      case "boolean": {
        if (typeof value !== "boolean" && value !== "true" && value !== "false") {
          errors.push(`参数 '${sp.name}' 应为布尔类型，当前值: ${String(value)}`)
        }
        break
      }
      case "date": {
        const dateStr = String(value)
        // 支持常见日期格式
        if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr) && isNaN(Date.parse(dateStr))) {
          errors.push(
            `参数 '${sp.name}' 日期格式无效，当前值: ${dateStr}` +
              (sp.format ? `，期望格式: ${sp.format}` : "，期望格式: yyyy-MM-dd"),
          )
        }
        break
      }
      case "enum": {
        if (sp.enum && sp.enum.length > 0 && !sp.enum.includes(String(value))) {
          errors.push(
            `参数 '${sp.name}' 的值 '${String(value)}' 不在允许范围 [${sp.enum.join(", ")}] 中`,
          )
        }
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/** 生成参数规范提示（用于错误时返回给 LLM） */
export function formatParamHints(structuredParams: StructuredParam[]): string {
  return structuredParams
    .map((sp) => {
      let hint = `- ${sp.name} (${sp.type}${sp.required ? ", 必填" : ", 可选"})`
      if (sp.description) hint += `: ${sp.description}`
      if (sp.enum) hint += ` [可选值: ${sp.enum.join(", ")}]`
      if (sp.format) hint += ` [格式: ${sp.format}]`
      if (sp.example !== undefined) hint += ` [示例: ${JSON.stringify(sp.example)}]`
      if (sp.default !== undefined) hint += ` [默认: ${JSON.stringify(sp.default)}]`
      return hint
    })
    .join("\n")
}

/** 敏感参数保留字黑名单，防止外部/用户/LLM参数覆盖预配置的核心字段（如 path, method 等导致的安全注入漏洞） */
export const SENSITIVE_KEYS = [
  "method",
  "path",
  "headers",
  "url",
  "baseUrl",
  "body",
  "requestBody",
  "queryParams",
  "operationType",
  "operationName",
  "query",
  "variables",
  "service",
  "requestMessage",
  "responseMessage",
  "action",
  "nodeIds",
  "dataType",
  "topic",
  "direction",
  "qos",
  "payloadFormat",
  "auth",
  "config",
  "enabled",
  "endpoints",
]

/**
 * 过滤外部传入的参数，移除敏感字，防范参数覆盖注入攻击
 */
export function safeFilterParams(
  params: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!params) return {}
  const filtered = { ...params }
  for (const key of SENSITIVE_KEYS) {
    delete filtered[key]
  }
  return filtered
}

/**
 * 根据各协议端点的特征，判定其是否为写操作（从而触发二次确认）
 */
export function isWriteEndpoint(ep: any): boolean {
  if (!ep) return false

  // 1. REST 协议判断 (只要包含 method 字段)
  if (ep.method !== undefined) {
    return ep.method !== "GET"
  }

  // 2. GraphQL 协议判断
  if (ep.operationType !== undefined) {
    return ep.operationType === "mutation"
  }

  // 3. OPC UA 协议判断
  if (ep.action !== undefined) {
    return ep.action === "write"
  }

  // 4. MQTT 协议判断
  if (ep.direction !== undefined) {
    return ep.direction === "publish" || ep.direction === "both"
  }

  // 5. gRPC 协议或其他兜底：只要存在 RPC service，我们均保守地默认视为写操作
  if (ep.service !== undefined) {
    return true
  }

  // 兜底返回 true，使非 REST 协议端点默认进入安全二次确认机制
  return true
}
