"use client"

import { useState, useRef } from "react"

// Lint 检查标签
interface LintIssue {
  file: string
  line?: number
  message: string
  severity: "error" | "warning" | "info"
  fixable?: boolean
}

interface Progress {
  percent: number
  current: string
  status: string
}

export default function LintTab() {
  const [taskId, setTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ percent: 0, current: "", status: "idle" })
  const [issues, setIssues] = useState<LintIssue[]>([])
  const esRef = useRef<EventSource | null>(null)

  const startLint = async () => {
    setIssues([])
    setProgress({ percent: 0, current: "", status: "running" })
    const res = await fetch("/api/wiki/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lint" }),
    })
    const data = await res.json()
    const id = data.id
    setTaskId(id)
    // 建立 SSE 连接
    const es = new EventSource(`/api/wiki/admin/tasks/${id}/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.progress !== undefined) {
        setProgress({
          percent: msg.progress,
          current: msg.current || "",
          status: msg.status || "running",
        })
      }
      if (msg.status === "completed") {
        setIssues(msg.issues || [])
        setProgress((p) => ({ ...p, status: "completed", percent: 100 }))
        es.close()
      }
      if (msg.status === "failed" || msg.status === "cancelled") {
        setProgress((p) => ({ ...p, status: msg.status }))
        es.close()
      }
    }
    es.onerror = () => {
      es.close()
    }
  }

  const control = async (action: string) => {
    if (!taskId) return
    await fetch(`/api/wiki/admin/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (action === "cancel") {
      esRef.current?.close()
      setProgress((p) => ({ ...p, status: "cancelled" }))
    }
    if (action === "pause") setProgress((p) => ({ ...p, status: "paused" }))
    if (action === "resume") setProgress((p) => ({ ...p, status: "running" }))
  }

  const autoFix = async () => {
    await fetch("/api/wiki/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lint-fix" }),
    })
    alert("自动修复任务已创建")
  }

  // 按严重级别分组
  const grouped = {
    error: issues.filter((i) => i.severity === "error"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  }

  const hasFixable = issues.some((i) => i.fixable)

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={startLint}
          disabled={progress.status === "running"}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          开始 Lint 检查
        </button>
        {progress.status === "running" && (
          <>
            <button
              onClick={() => control("pause")}
              className="px-3 py-2 bg-yellow-500 text-white rounded"
            >
              暂停
            </button>
            <button
              onClick={() => control("cancel")}
              className="px-3 py-2 bg-gray-500 text-white rounded"
            >
              取消
            </button>
          </>
        )}
        {progress.status === "paused" && (
          <>
            <button
              onClick={() => control("resume")}
              className="px-3 py-2 bg-green-600 text-white rounded"
            >
              继续
            </button>
            <button
              onClick={() => control("cancel")}
              className="px-3 py-2 bg-gray-500 text-white rounded"
            >
              取消
            </button>
          </>
        )}
        {progress.status === "completed" && hasFixable && (
          <button onClick={autoFix} className="px-4 py-2 bg-green-600 text-white rounded">
            自动修复
          </button>
        )}
      </div>

      {/* 进度条 */}
      {progress.status !== "idle" && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>{progress.current}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded h-3">
            <div
              className="bg-blue-600 h-3 rounded transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 结果展示 */}
      {progress.status === "completed" && (
        <div className="space-y-4">
          {grouped.error.length > 0 && (
            <div>
              <h3 className="font-bold text-red-600 mb-1">错误 ({grouped.error.length})</h3>
              {grouped.error.map((i, idx) => (
                <div key={idx} className="text-sm p-1 border-l-2 border-red-500 pl-2 mb-1">
                  <span className="font-mono">
                    {i.file}
                    {i.line ? `:${i.line}` : ""}
                  </span>{" "}
                  — {i.message}
                  {i.fixable && (
                    <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">
                      可修复
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {grouped.warning.length > 0 && (
            <div>
              <h3 className="font-bold text-yellow-600 mb-1">警告 ({grouped.warning.length})</h3>
              {grouped.warning.map((i, idx) => (
                <div key={idx} className="text-sm p-1 border-l-2 border-yellow-500 pl-2 mb-1">
                  <span className="font-mono">
                    {i.file}
                    {i.line ? `:${i.line}` : ""}
                  </span>{" "}
                  — {i.message}
                  {i.fixable && (
                    <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">
                      可修复
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {grouped.info.length > 0 && (
            <div>
              <h3 className="font-bold text-blue-600 mb-1">提示 ({grouped.info.length})</h3>
              {grouped.info.map((i, idx) => (
                <div key={idx} className="text-sm p-1 border-l-2 border-blue-500 pl-2 mb-1">
                  <span className="font-mono">
                    {i.file}
                    {i.line ? `:${i.line}` : ""}
                  </span>{" "}
                  — {i.message}
                </div>
              ))}
            </div>
          )}
          {issues.length === 0 && <div className="text-green-600 font-medium">✓ 未发现问题</div>}
        </div>
      )}
    </div>
  )
}
