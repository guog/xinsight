import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const root = process.cwd()

describe("console.log 守卫 + API_BASE 统一", () => {
  it("chat/route.ts 的 debug 日志均包含 NODE_ENV 守卫", () => {
    const source = readFileSync(join(root, "src/app/api/chat/route.ts"), "utf-8")
    const lines = source.split("\n")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith("console.log(") && line.includes("[chat]")) {
        // 检查前面几行是否有 NODE_ENV 守卫
        const context = lines.slice(Math.max(0, i - 3), i + 1).join("\n")
        expect(context).toContain('process.env.NODE_ENV === "development"')
      }
    }
  })

  it("chat/route.ts 的 console.error 不受守卫限制（生产环境也需要错误日志）", () => {
    const source = readFileSync(join(root, "src/app/api/chat/route.ts"), "utf-8")
    expect(source).toContain('console.error("持久化消息失败:"')
  })

  it("use-datasources.ts 使用模块级 apiBase 常量", () => {
    const source = readFileSync(join(root, "src/hooks/use-datasources.ts"), "utf-8")
    expect(source).toContain("const apiBase =")
    expect(source).toContain("NEXT_PUBLIC_API_URL")
    // 所有 fetch 调用都应使用 apiBase 前缀
    const fetchCalls = source.match(/fetch\(`?\$\{apiBase\}/g) || []
    const rawFetchCalls = source.match(/fetch\("\/api\//g) || []
    expect(fetchCalls.length).toBeGreaterThan(0)
    expect(rawFetchCalls.length).toBe(0)
  })

  it("use-voice-config.ts 使用模块级 apiBase 常量", () => {
    const source = readFileSync(join(root, "src/hooks/use-voice-config.ts"), "utf-8")
    expect(source).toContain("const apiBase =")
    expect(source).toContain("NEXT_PUBLIC_API_URL")
    // 不应在 useEffect 内部重新定义 apiBase
    const lines = source.split("\n")
    const inEffectDef = lines.some((l) => l.includes("const apiBase") && l.includes("process.env"))
    // 模块级定义存在，但 effect 内不应再有
    const moduleLevel = source.indexOf("const apiBase =")
    const effectStart = source.indexOf("useEffect(")
    expect(moduleLevel).toBeLessThan(effectStart)
  })

  it("use-chats.ts 使用模块级 apiBase 常量", () => {
    const source = readFileSync(join(root, "src/hooks/use-chats.ts"), "utf-8")
    expect(source).toContain("const apiBase =")
    expect(source).toContain("NEXT_PUBLIC_API_URL")
  })

  it("三个 hooks 的 apiBase 定义模式一致", () => {
    const pattern = 'typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL'
    for (const file of ["use-chats.ts", "use-datasources.ts", "use-voice-config.ts"]) {
      const source = readFileSync(join(root, "src/hooks", file), "utf-8")
      expect(source, `${file} 应包含统一的 apiBase 模式`).toContain(pattern)
    }
  })
})
