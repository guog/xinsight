// 平台检测与麦克风权限管理

/**
 * 检测是否运行在 Capacitor 原生平台
 */
export function isCapacitor(): boolean {
  try {
    // Capacitor 注入的全局对象
    return typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

/**
 * 检测是否运行在 Tauri 桌面平台
 */
export function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && !!(window as any).__TAURI__
  } catch {
    return false
  }
}

/**
 * 检测是否运行在普通 Web 浏览器环境
 */
export function isWeb(): boolean {
  return typeof window !== "undefined" && !isCapacitor() && !isTauri()
}

/**
 * 请求麦克风权限
 * - Web / Tauri: 使用标准 Web API (getUserMedia)
 * - Capacitor 原生: 通过 @capacitor/core Permissions API 请求
 * @returns 是否获得麦克风权限
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  // Capacitor 原生平台：使用 Capacitor Permissions API
  if (isCapacitor()) {
    try {
      const { Capacitor } = await import("@capacitor/core")
      if (Capacitor.isNativePlatform()) {
        // 动态导入避免非 Capacitor 环境报错
        const { Microphone } = await import("@anthropic-ai/capacitor-microphone" as any).catch(
          () => ({ Microphone: null }),
        )
        // 如果有专用麦克风插件则使用，否则回退到 Web API
        if (Microphone) {
          const status = await Microphone.requestPermissions()
          return status?.microphone === "granted"
        }
      }
    } catch {
      // 回退到 Web API
    }
  }

  // Web / Tauri / 回退路径：使用标准 getUserMedia API
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // 获取成功后立即释放音频轨道
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}
