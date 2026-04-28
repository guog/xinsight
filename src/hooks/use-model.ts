"use client"

import { useState, useCallback } from "react"
import { getDefaultModelId } from "@/lib/models"

const STORAGE_KEY = "xinsight:modelId"

function getInitialModelId(): string {
  if (typeof window === "undefined") return getDefaultModelId()
  return localStorage.getItem(STORAGE_KEY) ?? getDefaultModelId()
}

export function useModel() {
  const [modelId, setModelIdState] = useState<string>(getInitialModelId)

  const setModelId = useCallback((id: string) => {
    setModelIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  return { modelId, setModelId }
}
