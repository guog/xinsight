import { describe, it, expect } from "vitest"
import { parseChartBlocks } from "../parse-chart-block"

describe("parseChartBlocks", () => {
  it("解析单个有效 chart block", () => {
    const text = `一些分析结果：

\`\`\`chart
{"type":"bar","title":"销量对比","data":[{"name":"Q1","value":100},{"name":"Q2","value":200}]}
\`\`\`

以上是本季度数据。`

    const segments = parseChartBlocks(text)
    expect(segments).toHaveLength(3)
    expect(segments[0]).toEqual({ type: "text", content: "一些分析结果：\n\n" })
    expect(segments[1]).toEqual({
      type: "chart",
      config: {
        type: "bar",
        title: "销量对比",
        data: [
          { name: "Q1", value: 100 },
          { name: "Q2", value: 200 },
        ],
      },
    })
    expect(segments[2]).toEqual({ type: "text", content: "\n\n以上是本季度数据。" })
  })

  it("无 chart block 返回纯文本", () => {
    const text = "这是普通文本，没有图表。"
    const segments = parseChartBlocks(text)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toEqual({ type: "text", content: text })
  })

  it("多个 chart block", () => {
    const text = `第一张图：

\`\`\`chart
{"type":"line","data":[{"name":"1月","value":10}]}
\`\`\`

第二张图：

\`\`\`chart
{"type":"pie","data":[{"name":"A","value":60},{"name":"B","value":40}]}
\`\`\`
`

    const segments = parseChartBlocks(text)
    expect(segments.filter((s) => s.type === "chart")).toHaveLength(2)
    expect(segments.filter((s) => s.type === "text")).toHaveLength(2)
  })

  it("JSON 格式错误时降级为文本", () => {
    const text = `\`\`\`chart
{invalid json}
\`\`\``

    const segments = parseChartBlocks(text)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe("text")
  })

  it("type 非法时降级为文本", () => {
    const text = `\`\`\`chart
{"type":"scatter","data":[{"name":"x","value":1}]}
\`\`\``

    const segments = parseChartBlocks(text)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe("text")
  })

  it("data 为空数组时降级为文本", () => {
    const text = `\`\`\`chart
{"type":"bar","data":[]}
\`\`\``

    const segments = parseChartBlocks(text)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe("text")
  })

  it("空文本返回原始文本", () => {
    const segments = parseChartBlocks("")
    expect(segments).toHaveLength(1)
    expect(segments[0]).toEqual({ type: "text", content: "" })
  })
})
