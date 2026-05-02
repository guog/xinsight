"use client"
import { useState, useEffect } from "react"

interface ModelInfo { id: string; name: string; providerId: string; modelSlug: string; description?: string }
interface ProviderDisplay { id: string; name: string; type: string; models: ModelInfo[] }

export function useModels() {
  const [providers, setProviders] = useState<ProviderDisplay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(data => {
      setProviders(data.providers || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const models = providers.flatMap(p => p.models)
  const getModelById = (id: string) => models.find(m => m.id === id)

  return { providers, models, getModelById, loading }
}
