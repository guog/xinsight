/**
 * 解析 markdown 文本中的 ```chart 代码块
 * 返回文本片段和图表配置的交替数组
 */

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area"
  title?: string
  data: Array<Record<string, unknown>>
  series?: string[]
  xKey?: string
}

export type Segment = { type: "text"; content: string } | { type: "chart"; config: ChartConfig }

const CHART_BLOCK_RE = /```chart\s*\n([\s\S]*?)```/g

export function parseChartBlocks(text: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(CHART_BLOCK_RE)) {
    const start = match.index!
    if (start > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, start) })
    }

    try {
      const config = JSON.parse(match[1].trim()) as ChartConfig
      if (config.type && Array.isArray(config.data)) {
        segments.push({ type: "chart", config })
      } else {
        // Invalid chart config, keep as text
        segments.push({ type: "text", content: match[0] })
      }
    } catch {
      // JSON parse error, keep as text
      segments.push({ type: "text", content: match[0] })
    }

    lastIndex = start + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) })
  }

  // If no segments were created, return the whole text
  if (segments.length === 0) {
    segments.push({ type: "text", content: text })
  }

  return segments
}
