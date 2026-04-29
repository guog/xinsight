"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

interface Props {
  type: string
  config: Record<string, unknown>
  auth: Record<string, unknown>
}

type TestState = "idle" | "loading" | "success" | "error"

export default function ConnectionTestButton({ type, config, auth }: Props) {
  const [state, setState] = useState<TestState>("idle")
  const [message, setMessage] = useState("")
  const [latency, setLatency] = useState(0)

  const handleTest = async () => {
    setState("loading")
    setMessage("")
    const start = Date.now()

    try {
      const res = await fetch("/api/datasources/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config, auth }),
      })
      const data = await res.json()
      const elapsed = Date.now() - start
      setLatency(elapsed)

      if (data.ok) {
        setState("success")
        setMessage(data.message || `连接成功 (${elapsed}ms)`)
      } else {
        setState("error")
        setMessage(data.message || "连接失败")
      }
    } catch (err) {
      setState("error")
      setMessage(err instanceof Error ? err.message : "网络错误")
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleTest}
        disabled={state === "loading"}
        className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {state === "loading" && <Loader2 className="size-4 animate-spin" />}
        测试连接
      </button>
      {state === "success" && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle2 className="size-4" /> {message || `${latency}ms`}
        </span>
      )}
      {state === "error" && (
        <span className="flex items-center gap-1 text-sm text-red-600">
          <XCircle className="size-4" /> {message}
        </span>
      )}
    </div>
  )
}
