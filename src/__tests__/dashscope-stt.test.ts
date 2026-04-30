import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSTTSession } from "../lib/voice/dashscope-stt"

// Mock ws 模块
const mockSend = vi.fn()
const mockClose = vi.fn()
const mockOn = vi.fn()

vi.mock("ws", () => {
  return {
    default: class MockWebSocket {
      static OPEN = 1
      readyState = 1
      send = mockSend
      close = mockClose
      on = mockOn
      constructor() {}
    },
  }
})

describe("DashScope STT WebSocket 客户端", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("连接时发送正确的 run-task 消息", () => {
    createSTTSession("test-api-key", { languages: ["zh", "en"] })

    // 找到 open 事件回调并触发
    const openCall = mockOn.mock.calls.find((c) => c[0] === "open")
    expect(openCall).toBeDefined()
    openCall![1]()

    // 验证发送了 run-task 消息
    const sentMsg = JSON.parse(mockSend.mock.calls[0][0])
    expect(sentMsg.header.action).toBe("run-task")
    expect(sentMsg.header.streaming).toBe("duplex")
    expect(sentMsg.payload.model).toBe("paraformer-realtime-v2")
    expect(sentMsg.payload.parameters.sample_rate).toBe(16000)
    expect(sentMsg.payload.parameters.format).toBe("pcm")
    expect(sentMsg.payload.parameters.language_hints).toEqual(["zh", "en"])
  })

  it("sendAudio 发送 binary frame", () => {
    const session = createSTTSession("test-api-key")
    const buffer = new ArrayBuffer(320)
    session.sendAudio(buffer)
    expect(mockSend).toHaveBeenCalledWith(buffer)
  })

  it("收到 result-generated 事件时触发 onResult", () => {
    const session = createSTTSession("test-api-key")
    const onResult = vi.fn()
    session.onResult = onResult

    // 找到 message 回调并触发
    const msgCall = mockOn.mock.calls.find((c) => c[0] === "message")
    expect(msgCall).toBeDefined()

    const mockMsg = JSON.stringify({
      header: { task_id: "xxx", event: "result-generated" },
      payload: { output: { sentence: { text: "你好世界", end_time: 1000, begin_time: 0 } } },
    })
    msgCall![1](mockMsg)

    expect(onResult).toHaveBeenCalledWith("你好世界", true)
  })

  it("finish() 发送 finish-task 消息", () => {
    const session = createSTTSession("test-api-key")
    session.finish()

    const sentMsg = JSON.parse(mockSend.mock.calls[0][0])
    expect(sentMsg.header.action).toBe("finish-task")
    expect(sentMsg.header.task_id).toBeDefined()
  })
})
