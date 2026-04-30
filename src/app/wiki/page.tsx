"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface WikiPage {
  path: string
  title: string
  type?: string
  tags?: string[]
  modifiedAt?: string
}

export default function WikiListPage() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/wiki/pages")
      .then((res) => res.json())
      .then((data) => setPages(data))
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">知识库</h1>
        </div>
        <Link href="/wiki/feedbacks" className="text-sm text-blue-600 hover:underline">
          我的反馈
        </Link>
      </div>

      <input
        type="text"
        placeholder="搜索页面..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">暂无页面</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((page) => (
            <Link
              key={page.path}
              href={`/wiki/${encodeURIComponent(page.path)}`}
              className="block p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h2 className="font-semibold text-lg mb-1">{page.title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {page.type && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {page.type}
                  </span>
                )}
                {page.tags?.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              {page.modifiedAt && (
                <p className="text-xs text-gray-400 mt-2">
                  更新于 {new Date(page.modifiedAt).toLocaleDateString("zh-CN")}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
