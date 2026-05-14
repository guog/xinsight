"use client"

import { useState, useEffect, useCallback } from "react"

/** 语音配置 hook — 获取服务端语音启用状态 + 控制语音模式显隐 */
export function useVoiceConfig() {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isVoiceMode, setIsVoiceMode] = useState(false)

  useEffect(() => {
    let cancelled = false
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""
    fetch(`${apiBase}/api/voice/config`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setVoiceEnabled(!!data.enabled)
      })
      .catch(() => {
        if (!cancelled) setVoiceEnabled(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enterVoiceMode = useCallback(() => setIsVoiceMode(true), [])
  const exitVoiceMode = useCallback(() => setIsVoiceMode(false), [])

  return {
    voiceEnabled,
    loading,
    isVoiceMode,
    enterVoiceMode,
    exitVoiceMode,
  }
}
