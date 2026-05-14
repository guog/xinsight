import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("前端无障碍和 UX 修复", () => {
  describe("viewport 允许缩放", () => {
    const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf-8")

    it("userScalable 不为 false", () => {
      expect(source).not.toMatch(/userScalable:\s*false/)
    })

    it("maximumScale 大于 1", () => {
      const match = source.match(/maximumScale:\s*(\d+)/)
      expect(match).toBeTruthy()
      expect(Number(match![1])).toBeGreaterThan(1)
    })
  })

  describe("MobileChatPage 包裹 ErrorBoundary", () => {
    const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf-8")

    it("移动端使用 ErrorBoundary", () => {
      expect(source).toMatch(/ErrorBoundary[\s\S]*?MobileChatPage/)
    })
  })

  describe("JSON.parse parts 有 try-catch", () => {
    for (const file of ["src/app/page.tsx", "src/components/mobile-chat-page.tsx"]) {
      it(`${file} 中 parts 解析包含异常处理`, () => {
        const source = readFileSync(join(process.cwd(), file), "utf-8")
        // 查找 parts 解析附近有 try-catch
        expect(source).toMatch(/try\s*\{[\s\S]*?JSON\.parse\(m\.parts\)[\s\S]*?\}\s*catch/)
      })
    }
  })

  describe("版本号统一管理", () => {
    it("version.ts 导出 APP_VERSION", () => {
      const source = readFileSync(join(process.cwd(), "src/lib/version.ts"), "utf-8")
      expect(source).toContain("export const APP_VERSION")
    })

    for (const file of ["src/app/settings/page.tsx", "src/components/mobile-settings-page.tsx"]) {
      it(`${file} 使用 APP_VERSION 而非硬编码`, () => {
        const source = readFileSync(join(process.cwd(), file), "utf-8")
        expect(source).toContain("APP_VERSION")
        expect(source).not.toContain('"v0.1.0"')
      })
    }
  })

  describe("providers 页面不使用 alert()", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/providers/page.tsx"), "utf-8")

    it("不包含 alert() 调用", () => {
      // 排除注释中的 alert
      const lines = source.split("\n").filter((l) => !l.trim().startsWith("//"))
      const hasAlert = lines.some((l) => /\balert\(/.test(l))
      expect(hasAlert).toBe(false)
    })

    it("使用 toast 替代", () => {
      expect(source).toContain("toast")
    })
  })

  describe("datasource-form 不使用纯 index 作为 key", () => {
    const source = readFileSync(join(process.cwd(), "src/components/datasource-form.tsx"), "utf-8")

    it("endpoint 列表 key 使用 ep.id 而非纯 index", () => {
      // 不应有 key={i} 模式
      expect(source).not.toMatch(/key=\{i\}/)
    })
  })
})
