"use client"

import { useSyncExternalStore } from "react"

function getIsMobile(): boolean {
  if (typeof document === "undefined") return false
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("x-device="))
  if (cookie) return cookie.split("=")[1] === "mobile"
  return window.matchMedia("(max-width: 768px)").matches
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia("(max-width: 768px)")
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

/**
 * 检测当前设备是否为移动端
 * 优先读取中间件设置的 cookie，降级到 matchMedia
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getIsMobile, () => false)
}

/**
 * 服务端获取设备类型（从 cookie）
 */
export function getDeviceFromCookies(cookieStr: string): "mobile" | "desktop" {
  const match = cookieStr.match(/x-device=(mobile|desktop)/)
  return (match?.[1] as "mobile" | "desktop") ?? "desktop"
}
