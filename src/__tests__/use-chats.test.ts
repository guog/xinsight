import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"

/**
 * use-chats refresh 修复验证（#94）
 * 确保 ensureFetched 完成后清空 fetchPromise，允许 refresh 重新请求
 */

describe("useChats - refresh 逻辑", () => {
  it("ensureFetched 完成后应清空 fetchPromise 以允许 refresh 重新获取", () => {
    const source = readFileSync("src/hooks/use-chats.ts", "utf-8")

    // ensureFetched 函数中应该在 .then 和 .catch 中都清空 fetchPromise
    const ensureFetchedMatch = source.match(/function ensureFetched[\s\S]*?^}/m)
    expect(ensureFetchedMatch).toBeTruthy()
    const body = ensureFetchedMatch![0]
    // .then 中清空
    expect(body).toContain("fetchPromise = null")
    // .catch 中也清空
    const catchBlock = body.slice(body.indexOf(".catch"))
    expect(catchBlock).toContain("fetchPromise = null")
  })
})
