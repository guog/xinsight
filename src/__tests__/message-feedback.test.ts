import { describe, it, expect } from "vitest"

describe("消息反馈参数校验", () => {
  function validateFeedbackInput(body: unknown): {
    valid: boolean
    error?: string
  } {
    const { messageId, type } = (body ?? {}) as {
      messageId?: string
      type?: string
    }
    if (!messageId || !["up", "down"].includes(type ?? "")) {
      return { valid: false, error: "参数错误" }
    }
    return { valid: true }
  }

  it("合法的 up 反馈通过", () => {
    expect(validateFeedbackInput({ messageId: "msg-1", type: "up" })).toEqual({
      valid: true,
    })
  })

  it("合法的 down 反馈通过", () => {
    expect(validateFeedbackInput({ messageId: "msg-1", type: "down" })).toEqual({ valid: true })
  })

  it("缺少 messageId 失败", () => {
    expect(validateFeedbackInput({ type: "up" })).toEqual({
      valid: false,
      error: "参数错误",
    })
  })

  it("无效 type 失败", () => {
    expect(validateFeedbackInput({ messageId: "msg-1", type: "invalid" })).toEqual({
      valid: false,
      error: "参数错误",
    })
  })

  it("空 body 失败", () => {
    expect(validateFeedbackInput(null)).toEqual({
      valid: false,
      error: "参数错误",
    })
  })
})
