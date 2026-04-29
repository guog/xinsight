// 从 markdown text 中解析 ```chart 代码块

import type { ChartConfig, ChartType } from "./types"

const VALID_TYPES: ChartType[] = ["line", "bar", "pie", "area"]

// 匹配 ```chart ... ``` 代码块
const CHART_BLOCK_RE = /```chart\s*\n([\s\S]*?)```/g

export interface TextSegment {
  type: "text"
  content: string
}

export interface ChartSegment {
  type: "chart"
  config: ChartConfig
}

export type MessageSegment = TextSegment | ChartSegment

/**
 * 解析消息文本，提取 chart 代码块
 * 无效的 chart block 保留为原始文本
 */
export function parseChartBlocks(text: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let lastIndex = 0

  // 重置正则
  CHART_BLOCK_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = CHART_BLOCK_RE.exec(text)) !== null) {
    // 添加 chart block 之前的文本
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      if (before.trim()) {
        segments.push({ type: "text", content: before })
      }
    }

    // 尝试解析 JSON
    const jsonStr = match[1].trim()
    const config = tryParseChartConfig(jsonStr)

    if (config) {
      segments.push({ type: "chart", config })
    } else {
      // 解析失败，保留为原始代码块文本
      segments.push({ type: "text", content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining.trim()) {
      segments.push({ type: "text", content: remaining })
    }
  }

  // 如果没有任何段落（空文本），返回原始文本
  if (segments.length === 0) {
    return [{ type: "text", content: text }]
  }

  return segments
}

function tryParseChartConfig(jsonStr: string): ChartConfig | null {
  try {
    const obj = JSON.parse(jsonStr)

    // 校验必要字段
    if (!obj || typeof obj !== "object") return null
    if (!VALID_TYPES.includes(obj.type)) return null
    if (!Array.isArray(obj.data) || obj.data.length === 0) return null

    return obj as ChartConfig
  } catch {
    return null
  }
}
