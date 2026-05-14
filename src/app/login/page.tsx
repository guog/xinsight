"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Sparkles } from "lucide-react"

function LoginForm() {
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get("redirect") || "/"
  // 防止 Open Redirect：仅允许站内相对路径
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/"

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!username.trim() || !password) {
      setError("请输入用户名和密码")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "登录失败")
      }
      // 使用硬跳转确保在所有场景下可靠跳转（#92）
      window.location.href = redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
      setPassword("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 bg-card border border-border rounded-2xl p-8 shadow-lg shadow-primary/5 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="size-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">登录 xinsight</h1>
          <p className="text-sm text-muted-foreground">AI 洞察助手</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-200"
              placeholder="输入用户名"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-200"
              placeholder="输入密码"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            登录
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/register" className="text-primary hover:underline">
            注册
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
