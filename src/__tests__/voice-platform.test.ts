import { describe, it, expect, vi } from "vitest"

// 必须在导入前设置 window mock
const mockWindow = {} as any
vi.stubGlobal("window", mockWindow)

import { isCapacitor, isTauri, isWeb, requestMicrophonePermission } from "@/lib/voice/platform"

describe("platform 检测", () => {
  it("无 Capacitor 时返回 false", () => {
    expect(isCapacitor()).toBe(false)
  })

  it("有 Capacitor 且 isNativePlatform 返回 true", () => {
    ;(window as any).Capacitor = { isNativePlatform: () => true }
    expect(isCapacitor()).toBe(true)
    delete (window as any).Capacitor
  })

  it("无 __TAURI__ 时 isTauri 返回 false", () => {
    expect(isTauri()).toBe(false)
  })

  it("有 __TAURI__ 时 isTauri 返回 true", () => {
    ;(window as any).__TAURI__ = {}
    expect(isTauri()).toBe(true)
    delete (window as any).__TAURI__
  })

  it("普通浏览器环境 isWeb 返回 true", () => {
    expect(isWeb()).toBe(true)
  })

  it("Capacitor 环境 isWeb 返回 false", () => {
    ;(window as any).Capacitor = { isNativePlatform: () => true }
    expect(isWeb()).toBe(false)
    delete (window as any).Capacitor
  })

  it("requestMicrophonePermission Web 环境成功", async () => {
    const mockTrack = { stop: vi.fn() }
    const mockStream = { getTracks: () => [mockTrack] }
    ;(window as any).navigator = {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    }
    vi.stubGlobal("navigator", (window as any).navigator)
    const result = await requestMicrophonePermission()
    expect(result).toBe(true)
    expect(mockTrack.stop).toHaveBeenCalled()
  })

  it("requestMicrophonePermission 拒绝时返回 false", async () => {
    ;(window as any).navigator = {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
    }
    vi.stubGlobal("navigator", (window as any).navigator)
    const result = await requestMicrophonePermission()
    expect(result).toBe(false)
  })
})
