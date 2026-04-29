"use client"

import { useState, useEffect } from "react"

export interface AgentInfo {
  id: string
  name: string
}

/** 从 Mastra 动态获取已注册的 Agent 列表 */
export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/agents")
      .then((res) => {
        if (!res.ok) throw new Error("获取 Agent 列表失败")
        return res.json()
      })
      .then((data: AgentInfo[]) => {
        if (!cancelled) {
          setAgents(data)
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

  return { agents, loading, error }
}
