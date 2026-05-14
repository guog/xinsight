import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("useChats 缓存清理", () => {
  const source = readFileSync(join(process.cwd(), "src/hooks/use-chats.ts"), "utf-8")

  it("导出 clearChatsCache 函数", () => {
    expect(source).toContain("export function clearChatsCache()")
  })

  it("clearChatsCache 重置 cachedChats 为空数组", () => {
    expect(source).toMatch(/cachedChats\s*=\s*\[\]/)
  })

  it("clearChatsCache 重置 fetchPromise 为 null", () => {
    expect(source).toContain("fetchPromise = null")
  })

  it("clearChatsCache 调用 notifyListeners", () => {
    // 验证 clearChatsCache 函数体中调用了 notifyListeners
    const fnMatch = source.match(/export function clearChatsCache\(\)\s*\{([^}]+)\}/)
    expect(fnMatch).toBeTruthy()
    expect(fnMatch![1]).toContain("notifyListeners()")
  })

  it("sidebar 登出时调用 clearChatsCache", () => {
    const sidebarSource = readFileSync(join(process.cwd(), "src/components/sidebar.tsx"), "utf-8")
    expect(sidebarSource).toContain("clearChatsCache()")
    expect(sidebarSource).toContain("clearChatsCache } from")
  })
})
