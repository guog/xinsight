import { describe, it, expect } from "vitest"

/** 与 wiki/index.ts 中相同的正则转义逻辑 */
function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

describe("wiki-search 正则转义", () => {
  it("正常文本不受影响", () => {
    const regex = new RegExp(escapeRegex("hello"), "gi")
    expect("Hello World".match(regex)).toHaveLength(1)
  })

  it("特殊正则字符被转义", () => {
    const term = "(a+)+"
    const escaped = escapeRegex(term)
    const regex = new RegExp(escaped, "gi")
    // 不会导致 ReDoS，且能精确匹配字面文本
    expect("test (a+)+ end".match(regex)).toHaveLength(1)
    expect("test aaa end".match(regex)).toBeNull()
  })

  it("方括号和点号被转义", () => {
    const escaped = escapeRegex("[test].md")
    const regex = new RegExp(escaped, "gi")
    expect("[test].md file".match(regex)).toHaveLength(1)
    expect("testXmd file".match(regex)).toBeNull()
  })

  it("ReDoS 载荷不会挂起", () => {
    const malicious = "a]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]"
    const escaped = escapeRegex(malicious)
    const start = Date.now()
    const regex = new RegExp(escaped, "gi")
    const result = "some text".match(regex)
    const elapsed = Date.now() - start
    expect(result).toBeNull()
    expect(elapsed).toBeLessThan(100) // 不应挂起
  })
})
