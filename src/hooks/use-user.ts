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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user || null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading, isAdmin: user?.role === "admin" }
}
