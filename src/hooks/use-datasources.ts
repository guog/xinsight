"use client"

import { useState, useEffect, useCallback } from "react"

export interface DatasourceEndpoint {
  id: string
  name: string
  description?: string
  params?: Record<string, unknown>
  paramSchema?: string
  apiSchemaFormat?: "natural" | "openapi"
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
  lastTestedAt?: string | null
  lastTestResult?: string | null
  lastTestMessage?: string | null
  lastCalledAt?: string | null
  callCount?: number
}

const apiBase =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : ""

export function useDatasources() {
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/api/datasources`)
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
    fetch(`${apiBase}/api/datasources`)
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
    const res = await fetch(`${apiBase}/api/datasources/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("删除失败")
    setDatasources((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const testConnection = useCallback(
    async (id: string): Promise<{ ok: boolean; message?: string }> => {
      const res = await fetch(`${apiBase}/api/datasources/${id}/test`, { method: "POST" })
      const data = await res.json()
      return { ok: res.ok && data.ok, message: data.message }
    },
    [],
  )

  const duplicate = useCallback(async (id: string): Promise<Datasource> => {
    const res = await fetch(`${apiBase}/api/datasources/${id}/duplicate`, { method: "POST" })
    if (!res.ok) throw new Error("复制失败")
    const newDs = await res.json()
    setDatasources((prev) => [...prev, newDs])
    return newDs
  }, [])

  const batchUpdate = useCallback(async (action: "enable" | "disable", ids: string[]) => {
    const res = await fetch(`${apiBase}/api/datasources/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    })
    if (!res.ok) throw new Error("批量操作失败")
    const enabled = action === "enable"
    setDatasources((prev) => prev.map((d) => (ids.includes(d.id) ? { ...d, enabled } : d)))
  }, [])

  return { datasources, loading, error, refresh, remove, testConnection, duplicate, batchUpdate }
}
