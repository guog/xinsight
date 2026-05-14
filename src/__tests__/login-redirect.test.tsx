import { describe, test, expect } from "vitest"
import { readFileSync } from "fs"

/**
 * 验证登录成功后使用 window.location.href 进行硬跳转
 * 而非 router.push + router.refresh（后者在某些场景下不可靠）
 */
describe("登录成功后跳转", () => {
  test("登录页面代码应使用 window.location.href 而非 router.push", () => {
    const source = readFileSync("src/app/login/page.tsx", "utf-8")

    // 不应使用 router.push 进行跳转
    expect(source).not.toContain("router.push(redirect)")
    // 应使用 window.location.href 硬跳转
    expect(source).toContain("window.location.href")
  })
})
