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
    return <div className="max-w-4xl mx-auto p-6 text-gray-500">加载中...</div>
  }

  if (!page) {
    return <div className="max-w-4xl mx-auto p-6 text-gray-500">页面未找到</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/wiki" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{page.title}</h1>
      </div>

      <div className="prose max-w-none mb-10">
        <div className="whitespace-pre-wrap bg-gray-50 rounded-lg p-6 text-sm leading-relaxed">
          {page.content}
        </div>
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">提交反馈</h2>
        <div className="flex gap-2 mb-4">
          {FEEDBACK_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFeedbackType(t.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                feedbackType === t.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
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
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !feedbackContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? "提交中..." : "提交反馈"}
          </button>
          {message && (
            <span
              className={`text-sm ${message.includes("成功") ? "text-green-600" : "text-red-500"}`}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
