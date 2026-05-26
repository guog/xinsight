import { describe, it, expect } from "vitest"
import { feedbackSchema } from "@/lib/api-schemas"

describe("消息反馈参数校验", () => {
  it("合法的 up 反馈通过", () => {
    const result = feedbackSchema.safeParse({ messageId: "msg-1", type: "up" })
    expect(result.success).toBe(true)
  })

  it("合法的 down 反馈通过", () => {
    const result = feedbackSchema.safeParse({ messageId: "msg-1", type: "down" })
    expect(result.success).toBe(true)
  })

  it("带 comment 的反馈通过", () => {
    const result = feedbackSchema.safeParse({ messageId: "msg-1", type: "up", comment: "很有帮助" })
    expect(result.success).toBe(true)
  })

  it("缺少 messageId 失败", () => {
    const result = feedbackSchema.safeParse({ type: "up" })
    expect(result.success).toBe(false)
  })

  it("空 messageId 失败", () => {
    const result = feedbackSchema.safeParse({ messageId: "", type: "up" })
    expect(result.success).toBe(false)
  })

  it("无效 type 失败", () => {
    const result = feedbackSchema.safeParse({ messageId: "msg-1", type: "invalid" })
    expect(result.success).toBe(false)
  })

  it("空 body 失败", () => {
    const result = feedbackSchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it("comment 超过 1000 字符失败", () => {
    const result = feedbackSchema.safeParse({
      messageId: "msg-1",
      type: "up",
      comment: "a".repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})
