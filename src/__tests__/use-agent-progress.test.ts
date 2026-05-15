import { describe, it, expect, vi } from "vitest"
import { createAgentProgressStore } from "@/hooks/use-agent-progress"

describe("AgentProgressStore", () => {
  it("应该累积文本增量", () => {
    const store = createAgentProgressStore()
    store.append("run-1", "你好")
    store.append("run-1", "世界")
    expect(store.getText("run-1")).toBe("你好世界")
  })

  it("不同 runId 独立存储", () => {
    const store = createAgentProgressStore()
    store.append("run-1", "A")
    store.append("run-2", "B")
    expect(store.getText("run-1")).toBe("A")
    expect(store.getText("run-2")).toBe("B")
  })

  it("clear 应清空所有进度", () => {
    const store = createAgentProgressStore()
    store.append("run-1", "text")
    store.clear()
    expect(store.getText("run-1")).toBe("")
  })

  it("subscribe 应在 append 时通知", () => {
    const store = createAgentProgressStore()
    const cb = vi.fn()
    store.subscribe("run-1", cb)
    store.append("run-1", "delta")
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it("subscribe 不应在其他 runId append 时通知", () => {
    const store = createAgentProgressStore()
    const cb = vi.fn()
    store.subscribe("run-1", cb)
    store.append("run-2", "delta")
    expect(cb).not.toHaveBeenCalled()
  })

  it("unsubscribe 后不再通知", () => {
    const store = createAgentProgressStore()
    const cb = vi.fn()
    const unsub = store.subscribe("run-1", cb)
    unsub()
    store.append("run-1", "delta")
    expect(cb).not.toHaveBeenCalled()
  })

  it("clear 应通知所有订阅者", () => {
    const store = createAgentProgressStore()
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    store.subscribe("run-1", cb1)
    store.subscribe("run-2", cb2)
    store.clear()
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
  })
})
