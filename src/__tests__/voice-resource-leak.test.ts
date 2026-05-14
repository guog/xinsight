import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("语音资源泄漏修复", () => {
  describe("use-voice-chat.ts 卸载清理", () => {
    const source = readFileSync(join(process.cwd(), "src/hooks/use-voice-chat.ts"), "utf-8")

    it("卸载 cleanup 在 close 前发送 end 信令", () => {
      // useEffect cleanup 中应先发 end 再 close
      const cleanupMatch = source.match(
        /return \(\) => \{[\s\S]*?shouldReconnect[\s\S]*?send\(JSON\.stringify\(\{ type: "end" \}\)\)[\s\S]*?\.close\(\)/,
      )
      expect(cleanupMatch).toBeTruthy()
    })
  })

  describe("voice-chat-panel.tsx 卸载清理", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/voice/voice-chat-panel.tsx"),
      "utf-8",
    )

    it("useEffect 包含 recorder.stop 和 voice.end 清理", () => {
      // 在 connect 的 useEffect 中应有 cleanup
      expect(source).toContain("recorder.stop()")
      expect(source).toContain("voice.end()")
      // cleanup 应在 return () => 中
      const cleanupMatch = source.match(
        /return \(\) => \{[\s\S]*?recorder\.stop\(\)[\s\S]*?voice\.end\(\)/,
      )
      expect(cleanupMatch).toBeTruthy()
    })
  })

  describe("use-audio-recorder.ts 卸载清理", () => {
    const source = readFileSync(join(process.cwd(), "src/hooks/use-audio-recorder.ts"), "utf-8")

    it("卸载时断开 processor 并停止媒体流", () => {
      expect(source).toMatch(/return \(\) => \{[\s\S]*?disconnect/)
      expect(source).toMatch(/return \(\) => \{[\s\S]*?getTracks/)
    })

    it("卸载时关闭 AudioContext", () => {
      expect(source).toMatch(/return \(\) => \{[\s\S]*?contextRef\.current\.close/)
    })
  })
})
