import { describe, it, expect } from "vitest"
import { splitSentences } from "@/lib/text-utils"

describe("splitSentences", () => {
  it("按中文句号分割", () => {
    const [sentences, remainder] = splitSentences("你好。世界。")
    expect(sentences).toEqual(["你好。", "世界。"])
    expect(remainder).toBe("")
  })

  it("按英文句号分割", () => {
    const [sentences, remainder] = splitSentences("Hello. World.")
    expect(sentences).toEqual(["Hello.", " World."])
    expect(remainder).toBe("")
  })

  it("混合标点分割", () => {
    const [sentences, remainder] = splitSentences("真的吗？是的！好的。")
    expect(sentences).toEqual(["真的吗？", "是的！", "好的。"])
    expect(remainder).toBe("")
  })

  it("未完成句子作为 remainder 返回", () => {
    const [sentences, remainder] = splitSentences("完成。未完成")
    expect(sentences).toEqual(["完成。"])
    expect(remainder).toBe("未完成")
  })

  it("空字符串", () => {
    const [sentences, remainder] = splitSentences("")
    expect(sentences).toEqual([])
    expect(remainder).toBe("")
  })

  it("换行符也作为分隔", () => {
    const [sentences] = splitSentences("第一行\n第二行\n")
    expect(sentences.length).toBeGreaterThan(0)
  })
})
