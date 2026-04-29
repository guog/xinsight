"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface Feedback {
  id: string
  pagePath: string
  type: "纠错" | "补充" | "建议"
  content: string
  status: "pending" | "approved" | "rejected"
  reviewNote?: string
  createdAt: string
}

const statusMap = {
  pending: { label: "待审核", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "已通过", className: "bg-green-100 text-green-800" },
  rejected: { label: "已驳回", className: "bg-red-100 text-red-800" },
}

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/wiki/feedbacks")
      .then((res) => res.json())
      .then((data) => setFeedbacks(data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的反馈</h1>
        <Link href="/wiki" className="text-blue-600 hover:underline">
          ← 返回 Wiki
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : feedbacks.length === 0 ? (
        <p className="text-gray-500">暂无反馈记录</p>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb) => {
            const s = statusMap[fb.status]
            return (
              <div key={fb.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-gray-500">{fb.pagePath}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{fb.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.className}`}>{s.label}</span>
                </div>
                <p className="text-sm text-gray-800 line-clamp-2">{fb.content}</p>
                {fb.reviewNote && (
                  <p className="text-sm text-gray-600 mt-2 border-l-2 border-gray-300 pl-2">
                    审核备注：{fb.reviewNote}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(fb.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
