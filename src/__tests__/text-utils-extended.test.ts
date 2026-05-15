import { describe, it, expect } from "vitest"
import { splitSentences } from "@/lib/text-utils"

describe("splitSentences 边界情况", () => {
  it("连续标点", () => {
    const [sentences, remainder] = splitSentences("什么？！好的。")
    expect(sentences.length).toBeGreaterThan(0)
    expect(remainder).toBe("")
  })

  it("只有标点", () => {
    const [sentences] = splitSentences("。")
    expect(sentences.length).toBe(1)
  })

  it("长段落无标点", () => {
    const text = "这是一段没有标点的长文本"
    const [sentences, remainder] = splitSentences(text)
    expect(sentences).toEqual([])
    expect(remainder).toBe(text)
  })

  it("英文感叹号", () => {
    const [sentences, remainder] = splitSentences("Wow! Amazing!")
    expect(sentences).toEqual(["Wow!", " Amazing!"])
    expect(remainder).toBe("")
  })
})
