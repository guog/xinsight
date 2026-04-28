"use client"

import { useState, useEffect, useCallback } from "react"

export interface DatasourceEndpoint {
  id: string
  name: string
  description?: string
  params?: Record<string, unknown>
  paramSchema?: string
  responseExample?: string
}

export interface Datasource {
  id: string
  name: string
  type: "rest" | "graphql" | "grpc" | "opcua" | "mqtt"
  description?: string
  enabled: boolean
  config: Record<string, unknown>
  auth?: Record<string, unknown>
  endpoints?: DatasourceEndpoint[]
  agents?: string[]
}

export function useDatasources() {
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/datasources")
      if (!res.ok) throw new Error("获取数据源列表失败")
      const data = await res.json()
      setDatasources(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/datasources")
      .then((res) => {
        if (!res.ok) throw new Error("获取数据源列表失败")
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setDatasources(data)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "未知错误")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/datasources/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("删除失败")
    setDatasources((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const testConnection = useCallback(
    async (id: string): Promise<{ ok: boolean; message?: string }> => {
      const res = await fetch(`/api/datasources/${id}/test`, { method: "POST" })
      const data = await res.json()
      return { ok: res.ok && data.ok, message: data.message }
    },
    [],
  )

  return { datasources, loading, error, refresh, remove, testConnection }
}
