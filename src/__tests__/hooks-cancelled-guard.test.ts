import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const hooksDir = join(process.cwd(), "src/hooks")

describe("Hook cancelled 守卫 + error 状态", () => {
  const hooks = [
    { name: "use-models.ts", needsError: true, needsCancelled: true, needsMemo: true },
    { name: "use-user.ts", needsError: true, needsCancelled: true },
    { name: "use-voice-config.ts", needsCancelled: true },
  ]

  for (const { name, needsError, needsCancelled, needsMemo } of hooks) {
    describe(name, () => {
      const source = readFileSync(join(hooksDir, name), "utf-8")

      if (needsCancelled) {
        it("useEffect 包含 cancelled 守卫", () => {
          expect(source).toContain("let cancelled = false")
          expect(source).toContain("cancelled = true")
        })
      }

      if (needsError) {
        it("暴露 error 状态", () => {
          expect(source).toMatch(/const \[error, setError\]/)
          // return 中包含 error
          expect(source).toMatch(/return.*error/)
        })
      }

      if (needsMemo) {
        it("models 使用 useMemo 避免每次 render 重建", () => {
          expect(source).toContain("useMemo")
        })
      }
    })
  }

  describe("use-user.ts 区分 401 和其他错误", () => {
    const source = readFileSync(join(hooksDir, "use-user.ts"), "utf-8")

    it("401 返回明确的未登录消息", () => {
      expect(source).toContain("401")
      expect(source).toContain("未登录")
    })
  })

  describe("use-onboarding.ts storage 事件过滤", () => {
    const source = readFileSync(join(hooksDir, "use-onboarding.ts"), "utf-8")

    it("subscribe 过滤 storage key", () => {
      expect(source).toContain("STORAGE_KEY")
      expect(source).toMatch(/e\.key.*STORAGE_KEY/)
    })
  })
})
