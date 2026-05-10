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
