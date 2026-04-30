"use client"

import { useState, useEffect, useCallback } from "react"

/** 语音配置 hook — 获取服务端语音启用状态 + 控制语音模式显隐 */
export function useVoiceConfig() {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isVoiceMode, setIsVoiceMode] = useState(false)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""
    fetch(`${apiBase}/api/voice/config`)
      .then((res) => res.json())
      .then((data) => {
        setVoiceEnabled(!!data.enabled)
      })
      .catch(() => {
        setVoiceEnabled(false)
      })
      .finally(() => {
        setLoading(false)
      })
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
