"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "xinsight:modelId"
const FALLBACK_MODEL = "deepseek/deepseek-v4-flash"

function subscribeToStorage(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}

function getStoredModelId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? FALLBACK_MODEL
}

function getServerSnapshot(): string {
  return FALLBACK_MODEL
}

export function useModel() {
  const modelId = useSyncExternalStore(subscribeToStorage, getStoredModelId, getServerSnapshot)

  const setModelId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    // Trigger re-render by dispatching a storage event manually
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: id }))
  }, [])

  return { modelId, setModelId }
}
