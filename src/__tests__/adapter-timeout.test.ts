import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const adapterDir = join(process.cwd(), "src/mastra/tools/datasource/adapters")

describe("MQTT/gRPC/OPC-UA 适配器请求超时", () => {
  const adapters = [
    { name: "mqtt-adapter", file: "mqtt-adapter.ts" },
    { name: "grpc-adapter", file: "grpc-adapter.ts" },
    { name: "opcua-adapter", file: "opcua-adapter.ts" },
  ]

  for (const { name, file } of adapters) {
    describe(name, () => {
      const source = readFileSync(join(adapterDir, file), "utf-8")

      it("query 方法的 fetch 使用 AbortSignal.timeout", () => {
        expect(source).toContain("AbortSignal.timeout")
      })

      it("testConnection 方法的 fetch 也使用超时", () => {
        // testConnection 中至少一个 fetch 有 signal
        const testConnFn = source.match(/async testConnection[\s\S]*?^\s{2}\}/m)
        expect(testConnFn).toBeTruthy()
        expect(testConnFn![0]).toContain("AbortSignal.timeout")
      })
    })
  }
})
