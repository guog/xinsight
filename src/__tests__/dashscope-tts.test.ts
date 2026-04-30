import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTTSSession } from "../lib/voice/dashscope-tts"

// Mock ws 模块
const mockSend = vi.fn()
const mockClose = vi.fn()
let mockOnOpen: (() => void) | null = null
let mockOnMessage: ((data: unknown) => void) | null = null
let mockOnError: ((err: Error) => void) | null = null
let mockOnClose: (() => void) | null = null
let capturedUrl: string | null = null
let capturedOptions: Record<string, unknown> | null = null

vi.mock("ws", () => {
  return {
    default: class MockWebSocket {
      constructor(url: string, options?: Record<string, unknown>) {
        capturedUrl = url
        capturedOptions = options ?? null
      }
      send = mockSend
      close = mockClose
      set onopen(fn: () => void) {
        mockOnOpen = fn
      }
      set onmessage(fn: (data: unknown) => void) {
        mockOnMessage = fn
      }
      set onerror(fn: (err: Error) => void) {
        mockOnError = fn
      }
      set onclose(fn: () => void) {
        mockOnClose = fn
      }
    },
  }
})

describe("DashScope TTS WebSocket 客户端", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnOpen = null
    mockOnMessage = null
    mockOnError = null
    mockOnClose = null
    capturedUrl = null
    capturedOptions = null
  })

  it("连接时发送正确的 run-task 消息", () => {
    const session = createTTSSession("test-api-key", { voice: "longxiaochun" })

    // 验证连接地址和认证头
    expect(capturedUrl).toBe("wss://dashscope.aliyuncs.com/api-ws/v1/inference")
    expect(capturedOptions?.headers).toEqual({
      Authorization: "bearer test-api-key",
    })

    // 模拟连接打开
    mockOnOpen!()

    // 验证发送了 run-task 消息
    expect(mockSend).toHaveBeenCalledTimes(1)
    const msg = JSON.parse(mockSend.mock.calls[0][0])
    expect(msg.header.action).toBe("run-task")
    expect(msg.header.streaming).toBe("duplex")
    expect(msg.header.task_id).toBeDefined()
    expect(msg.payload.model).toBe("cosyvoice-v1")
    expect(msg.payload.task).toBe("tts")
    expect(msg.payload.parameters.voice).toBe("longxiaochun")
    expect(msg.payload.parameters.format).toBe("pcm")
    expect(msg.payload.parameters.sample_rate).toBe(22050)
    expect(msg.payload.input.text).toBe("")
  })

  it("sendText 发送 continue-task 消息", () => {
    const session = createTTSSession("test-api-key")
    mockOnOpen!()
    mockSend.mockClear()

    session.sendText("你好世界")

    expect(mockSend).toHaveBeenCalledTimes(1)
    const msg = JSON.parse(mockSend.mock.calls[0][0])
    expect(msg.header.action).toBe("continue-task")
    expect(msg.header.task_id).toBeDefined()
    expect(msg.payload.input.text).toBe("你好世界")
  })

  it("收到 binary frame 时触发 onAudio", () => {
    const session = createTTSSession("test-api-key")
    const onAudio = vi.fn()
    session.onAudio = onAudio
    mockOnOpen!()

    // 模拟收到二进制音频数据
    const audioData = new ArrayBuffer(1024)
    mockOnMessage!({ data: audioData })

    expect(onAudio).toHaveBeenCalledTimes(1)
    expect(onAudio).toHaveBeenCalledWith(audioData)
  })

  it("flush() 发送 finish-task 消息", () => {
    const session = createTTSSession("test-api-key")
    mockOnOpen!()
    mockSend.mockClear()

    session.flush()

    expect(mockSend).toHaveBeenCalledTimes(1)
    const msg = JSON.parse(mockSend.mock.calls[0][0])
    expect(msg.header.action).toBe("finish-task")
    expect(msg.header.task_id).toBeDefined()
  })

  it("收到 task-finished 时触发 onDone", () => {
    const session = createTTSSession("test-api-key")
    const onDone = vi.fn()
    session.onDone = onDone
    mockOnOpen!()

    // 模拟收到 task-finished 事件
    const event = JSON.stringify({
      header: { event: "task-finished" },
    })
    mockOnMessage!({ data: event })

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("收到错误时触发 onError", () => {
    const session = createTTSSession("test-api-key")
    const onError = vi.fn()
    session.onError = onError

    mockOnError!(new Error("连接失败"))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toBe("连接失败")
  })

  it("close() 关闭 WebSocket 连接", () => {
    const session = createTTSSession("test-api-key")
    session.close()
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("支持自定义参数", () => {
    createTTSSession("key", {
      model: "cosyvoice-v2",
      voice: "zhiyan",
      sampleRate: 16000,
      format: "mp3",
    })
    mockOnOpen!()

    const msg = JSON.parse(mockSend.mock.calls[0][0])
    expect(msg.payload.model).toBe("cosyvoice-v2")
    expect(msg.payload.parameters.voice).toBe("zhiyan")
    expect(msg.payload.parameters.sample_rate).toBe(16000)
    expect(msg.payload.parameters.format).toBe("mp3")
  })
})
