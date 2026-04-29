"use client"

import { useState } from "react"
import { Loader2, X } from "lucide-react"
import type { RestEndpoint } from "@/mastra/tools/datasource/types"

interface ParsedResult {
  baseUrl?: string
  endpoints: RestEndpoint[]
  info: { title: string; version: string }
}

interface Props {
  open: boolean
  onClose: () => void
  onImport: (result: ParsedResult) => void
}

export default function OpenApiImportDialog({ open, onClose, onImport }: Props) {
  const [tab, setTab] = useState<"url" | "paste">("url")
  const [url, setUrl] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<ParsedResult | null>(null)

  if (!open) return null

  const handleParse = async () => {
    setLoading(true)
    setError("")
    setPreview(null)

    try {
      const body = tab === "url" ? { url } : { content }
      const res = await fetch("/api/datasources/import-openapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "解析失败")
      }
      const result: ParsedResult = await res.json()
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (preview) {
      onImport(preview)
      onClose()
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl p-6 w-full max-w-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">导入 OpenAPI 规范</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${tab === "url" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${tab === "paste" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
          >
            粘贴
          </button>
        </div>

        {tab === "url" ? (
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/openapi.json" />
        ) : (
          <textarea className={`${inputClass} min-h-[120px] font-mono`} value={content} onChange={(e) => setContent(e.target.value)} placeholder="粘贴 OpenAPI JSON 或 YAML 内容" rows={6} />
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        {preview && (
          <div className="mt-4 p-3 border border-border rounded-lg bg-muted/30">
            <p className="text-sm font-medium">{preview.info.title} v{preview.info.version}</p>
            <p className="text-sm text-muted-foreground">发现 {preview.endpoints.length} 个接口</p>
            {preview.baseUrl && <p className="text-xs text-muted-foreground">Base URL: {preview.baseUrl}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
            取消
          </button>
          {preview ? (
            <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              导入 {preview.endpoints.length} 个接口
            </button>
          ) : (
            <button
              type="button"
              onClick={handleParse}
              disabled={loading || (tab === "url" ? !url : !content)}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              解析
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
