"use client"
import { useState, useEffect, useMemo } from "react"

interface ModelInfo {
  id: string
  name: string
  providerId: string
  modelSlug: string
  description?: string
}
interface ProviderDisplay {
  id: string
  name: string
  type: string
  models: ModelInfo[]
}

export function useModels() {
  const [providers, setProviders] = useState<ProviderDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setProviders(data.providers || [])
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "获取模型列表失败")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const models = useMemo(() => providers.flatMap((p) => p.models), [providers])
  const getModelById = (id: string) => models.find((m) => m.id === id)

  return { providers, models, getModelById, loading, error }
}
