"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CardGridSkeleton } from "@/components/skeleton"

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
      .then((data) => setPages(Array.isArray(data) ? data : []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 pb-20 md:pb-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">知识库</h1>
        </div>
        <Link
          href="/wiki/feedbacks"
          className="text-sm text-primary hover:underline transition-colors"
        >
          我的反馈
        </Link>
      </div>

      <input
        type="text"
        placeholder="搜索页面..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">暂无页面</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((page) => (
            <Link
              key={page.path}
              href={`/wiki/${encodeURIComponent(page.path)}`}
              className="block p-4 border border-border rounded-lg bg-card hover:shadow-md transition-all hover:border-primary/30"
            >
              <h2 className="font-semibold text-lg mb-1 text-card-foreground">{page.title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {page.type && (
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                    {page.type}
                  </span>
                )}
                {page.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {page.modifiedAt && (
                <p className="text-xs text-muted-foreground/70 mt-2">
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
