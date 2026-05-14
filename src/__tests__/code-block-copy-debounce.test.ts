import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("CodeBlockCopy MutationObserver 防抖", () => {
  const source = readFileSync(join(process.cwd(), "src/components/code-block-copy.tsx"), "utf-8")

  it("使用 setTimeout 防抖而非直接调用", () => {
    expect(source).toContain("setTimeout(addCopyButtons")
    // 不应直接将 addCopyButtons 传给 MutationObserver
    expect(source).not.toMatch(/new MutationObserver\(addCopyButtons\)/)
  })

  it("使用 clearTimeout 清除上一次定时器", () => {
    expect(source).toContain("clearTimeout(debounceTimer)")
  })

  it("cleanup 时清除定时器和断开 observer", () => {
    // cleanup 函数中同时清除 timer 和 disconnect
    const cleanup = source.match(/return \(\) => \{([^}]+)\}/s)
    expect(cleanup).toBeTruthy()
    expect(cleanup![1]).toContain("clearTimeout")
    expect(cleanup![1]).toContain("observer.disconnect()")
  })
})
