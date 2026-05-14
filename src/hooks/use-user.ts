"use client"

import { useState, useEffect } from "react"

interface User {
  id: string
  username: string
  displayName: string | null
  role: "admin" | "user"
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 401 ? "未登录" : `请求失败 (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data?.id ? data : null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "未知错误")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { user, loading, error, isAdmin: user?.role === "admin" }
}
