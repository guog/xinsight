import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"

/**
 * MessageAction hydration 修复验证（#93）
 * 确保 TooltipTrigger 使用 render prop 而非嵌套 button
 */

describe("MessageAction - hydration 安全", () => {
  it("TooltipTrigger 不应嵌套 button 子元素", () => {
    const source = readFileSync("src/components/ai-elements/message.tsx", "utf-8")

    // 不应出现 <TooltipTrigger>{button}</TooltipTrigger> 这种嵌套模式
    expect(source).not.toMatch(/<TooltipTrigger>\s*\{button\}\s*<\/TooltipTrigger>/)

    // 应使用 render prop 模式
    expect(source).toMatch(/<TooltipTrigger[\s\S]*?render=/)
  })
})
