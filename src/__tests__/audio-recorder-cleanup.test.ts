import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("useAudioRecorder 资源清理", () => {
  const source = readFileSync(join(process.cwd(), "src/hooks/use-audio-recorder.ts"), "utf-8")

  it("导入了 useEffect", () => {
    expect(source).toContain("useEffect")
  })

  it("包含 cleanup effect（组件卸载时清理）", () => {
    // 检查存在 useEffect + return cleanup 模式
    expect(source).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{/)
  })

  it("cleanup 中关闭 AudioContext", () => {
    expect(source).toContain("contextRef.current.close()")
  })

  it("cleanup 中停止 MediaStream tracks", () => {
    expect(source).toContain("streamRef.current?.getTracks().forEach")
  })

  it("cleanup 中断开 processor", () => {
    expect(source).toContain("processorRef.current?.disconnect()")
  })
})
