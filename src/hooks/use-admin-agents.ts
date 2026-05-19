"use client"

import { useState, useEffect, useCallback } from "react"

export interface AdminAgent {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  modelId: string | null
  icon: string | null
  isBuiltin: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function useAdminAgents() {
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/agents")
      if (!res.ok) throw new Error("加载失败")
      const data = await res.json()
      setAgents(data.agents)
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/agents")
      .then((res) => {
        if (!res.ok) throw new Error("加载失败")
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setAgents(data.agents)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/agents/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "删除失败")
      }
      await refresh()
    },
    [refresh],
  )

  const toggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      const res = await fetch(`/api/admin/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "更新失败")
      }
      await refresh()
    },
    [refresh],
  )

  return { agents, loading, error, refresh, remove, toggleEnabled }
}
