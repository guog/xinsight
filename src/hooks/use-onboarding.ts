"use client"

import { useSyncExternalStore, useCallback } from "react"

const STORAGE_KEY = "xinsight_onboarding_complete"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

// 全局禁用引导（暂时）
function getSnapshot() {
  return true
}

function getServerSnapshot() {
  return true
}

/** 首次使用检测 hook */
export function useOnboarding() {
  const isComplete = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const markComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true")
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new StorageEvent("storage"))
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new StorageEvent("storage"))
  }, [])

  return { isOnboardingComplete: isComplete, markComplete, reset }
}
