"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const FEEDBACK_TYPES = [
  { value: "correction", label: "纠错" },
  { value: "addition", label: "补充" },
  { value: "suggestion", label: "建议" },
]

interface PageData {
  path: string
  title: string
  content: string
}

export default function WikiDetailPage() {
  const params = useParams<{ path: string }>()
  const path = decodeURIComponent(params.path ?? "")

  const [page, setPage] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedbackType, setFeedbackType] = useState("correction")
  const [feedbackContent, setFeedbackContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!path) return
    fetch(`/api/wiki/pages/${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => setPage(data))
      .catch(() => setPage(null))
      .finally(() => setLoading(false))
  }, [path])

  const handleSubmit = async () => {
    if (!feedbackContent.trim()) return
    setSubmitting(true)
    setMessage("")
    try {
      const res = await fetch("/api/wiki/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: path,
          type: feedbackType,
          content: feedbackContent,
        }),
      })
      if (res.ok) {
        setMessage("提交成功，感谢您的反馈！")
        setFeedbackContent("")
      } else {
        setMessage("提交失败，请稍后重试")
      }
    } catch {
      setMessage("提交失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto p-6 text-muted-foreground">加载中...</div>
  }

  if (!page) {
    return <div className="max-w-4xl mx-auto p-6 text-muted-foreground">页面未找到</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/wiki"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{page.title}</h1>
      </div>

      <div className="prose max-w-none mb-10">
        <div className="whitespace-pre-wrap bg-muted rounded-lg p-6 text-sm leading-relaxed text-foreground">
          {page.content}
        </div>
      </div>

      <div className="border-t border-border pt-6 rounded-lg bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">提交反馈</h2>
        <div className="flex gap-2 mb-4">
          {FEEDBACK_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFeedbackType(t.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                feedbackType === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={feedbackContent}
          onChange={(e) => setFeedbackContent(e.target.value)}
          placeholder="请输入反馈内容..."
          rows={4}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !feedbackContent.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
          >
            {submitting ? "提交中..." : "提交反馈"}
          </button>
          {message && (
            <span
              className={`text-sm ${message.includes("成功") ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
