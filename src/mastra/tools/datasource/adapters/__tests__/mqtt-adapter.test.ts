import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MqttAdapter } from "../mqtt-adapter"
import type { DatasourceConfig } from "../../types"

/** 构造测试用 MQTT 数据源配置 */
function makeConfig(overrides: Partial<DatasourceConfig> = {}): DatasourceConfig {
  return {
    id: "ds-mqtt-1",
    name: "测试MQTT数据源",
    type: "mqtt",
    auth: { type: "none" },
    config: {
      brokerUrl: "https://mqtt-bridge.example.com/api/v1",
      defaultTopic: "device/status",
      timeout: 5000,
    },
    endpoints: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("MqttAdapter", () => {
  let adapter: MqttAdapter
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new MqttAdapter()
    mockFetch = vi.fn()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("type 应为 mqtt", () => {
    expect(adapter.type).toBe("mqtt")
  })

  it("发布消息成功", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const result = await adapter.query(makeConfig(), {
      action: "publish",
      topic: "device/control",
      payload: { command: "restart" },
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ published: true })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe("https://mqtt-bridge.example.com/api/v1")
    expect(opts.method).toBe("POST")
    const body = JSON.parse(opts.body)
    expect(body.action).toBe("publish")
    expect(body.topic).toBe("device/control")
    expect(body.payload).toEqual({ command: "restart" })
  })

  it("订阅一次消息成功", async () => {
    const msgData = { temperature: 25.5, humidity: 60 }
    mockFetch.mockResolvedValue(new Response(JSON.stringify(msgData), { status: 200 }))

    const result = await adapter.query(makeConfig(), {
      action: "subscribe_once",
      topic: "sensor/data",
      timeout: 3000,
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(msgData)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.action).toBe("subscribe_once")
    expect(body.topic).toBe("sensor/data")
    expect(body.timeout).toBe(3000)
  })

  it("未指定 topic 时使用 defaultTopic", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await adapter.query(makeConfig(), {
      action: "publish",
      payload: { value: 1 },
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.topic).toBe("device/status")
  })

  it("Bearer 认证注入 Authorization 头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({ auth: { type: "bearer", token: "mqtt-token" } })
    await adapter.query(config, { action: "publish", payload: "test" })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["Authorization"]).toBe("Bearer mqtt-token")
  })

  it("Basic 认证注入编码后的头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({ auth: { type: "basic", username: "admin", password: "secret" } })
    await adapter.query(config, { action: "publish", payload: "test" })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["Authorization"]).toBe(`Basic ${btoa("admin:secret")}`)
  })

  it("API Key 认证注入自定义头", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    const config = makeConfig({
      auth: { type: "apikey", key: "X-API-Key", value: "secret-key", in: "header" },
    })
    await adapter.query(config, { action: "publish", payload: "test" })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers["X-API-Key"]).toBe("secret-key")
  })

  it("HTTP 错误返回 success=false", async () => {
    mockFetch.mockResolvedValue(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
    )

    const result = await adapter.query(makeConfig(), {
      action: "publish",
      payload: "test",
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("500")
  })

  it("网络错误返回 success=false", async () => {
    mockFetch.mockRejectedValue(new Error("fetch failed"))

    const result = await adapter.query(makeConfig(), { action: "publish", payload: "test" })

    expect(result.success).toBe(false)
    expect(result.error).toContain("fetch failed")
  })

  it("testConnection 成功", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ version: "5.0.0" }), { status: 200 }))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(true)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.action).toBe("subscribe_once")
    expect(body.topic).toBe("$SYS/broker/version")
    expect(body.timeout).toBe(5000)
  })

  it("testConnection 失败", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"))

    const result = await adapter.testConnection(makeConfig())

    expect(result.ok).toBe(false)
    expect(result.message).toContain("connection refused")
  })
})
