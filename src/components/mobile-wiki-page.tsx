"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, FileText, ChevronRight } from "lucide-react"
import { CardGridSkeleton } from "@/components/skeleton"

interface WikiPage {
  path: string
  title: string
  updatedAt: string
}

export function MobileWikiPage() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""
    fetch(`${apiBase}/api/wiki/pages`)
      .then((r) => r.json())
      .then((data) => setPages(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-dvh safe-top">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold mb-3">知识库</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索页面..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {search ? "没有匹配的页面" : "暂无页面"}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((page) => (
              <Link
                key={page.path}
                href={`/wiki/${page.path}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border active:bg-muted transition-colors"
              >
                <FileText className="size-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{page.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(page.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
