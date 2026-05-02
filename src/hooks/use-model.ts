"use client"

import { useState, useCallback } from "react"

const STORAGE_KEY = "xinsight:modelId"
const FALLBACK_MODEL = "deepseek/deepseek-v4-flash"

function getInitialModelId(): string {
  if (typeof window === "undefined") return FALLBACK_MODEL
  return localStorage.getItem(STORAGE_KEY) ?? FALLBACK_MODEL
}

export function useModel() {
  const [modelId, setModelIdState] = useState<string>(getInitialModelId)

  const setModelId = useCallback((id: string) => {
    setModelIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  return { modelId, setModelId }
}
