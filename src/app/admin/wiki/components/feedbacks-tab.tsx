"use client"

import { useEffect, useState } from "react"

interface Feedback {
  id: string
  pagePath: string
  type: "纠错" | "补充" | "建议"
  content: string
  status: "pending" | "approved" | "rejected"
  reviewNote?: string
  createdAt: string
  user?: { displayName: string }
}

type Filter = "all" | "pending" | "processed"

const statusMap = {
  pending: { label: "待审核", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "已通过", className: "bg-green-100 text-green-800" },
  rejected: { label: "已驳回", className: "bg-red-100 text-red-800" },
}

export default function FeedbacksTab() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const fetchFeedbacks = () => {
    setLoading(true)
    fetch("/api/wiki/admin/feedbacks")
      .then((res) => res.json())
      .then((data) => setFeedbacks(data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    fetch("/api/wiki/admin/feedbacks")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setFeedbacks(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    await fetch(`/api/wiki/admin/feedbacks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote: reviewNotes[id] || "" }),
    })
    fetchFeedbacks()
  }

  const filtered = feedbacks.filter((fb) => {
    if (filter === "pending") return fb.status === "pending"
    if (filter === "processed") return fb.status === "approved" || fb.status === "rejected"
    return true
  })

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "pending", label: "待审核" },
    { key: "processed", label: "已处理" },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">暂无反馈</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => {
            const s = statusMap[fb.status]
            const isExpanded = expandedId === fb.id
            return (
              <div key={fb.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="font-medium text-sm">{fb.user?.displayName || "未知用户"}</span>
                  <span className="text-sm text-gray-500">{fb.pagePath}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{fb.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.className}`}>{s.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(fb.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>

                <p
                  className={`text-sm text-gray-800 cursor-pointer ${
                    isExpanded ? "" : "line-clamp-2"
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                >
                  {fb.content}
                </p>

                {fb.status === "pending" && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="审核备注（可选）"
                      value={reviewNotes[fb.id] || ""}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({
                          ...prev,
                          [fb.id]: e.target.value,
                        }))
                      }
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => handleAction(fb.id, "approved")}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => handleAction(fb.id, "rejected")}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      驳回
                    </button>
                  </div>
                )}

                {fb.reviewNote && (
                  <p className="text-sm text-gray-600 mt-2 border-l-2 border-gray-300 pl-2">
                    审核备注：{fb.reviewNote}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
