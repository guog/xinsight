"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Paperclip, X, FileText, Loader2 } from "lucide-react"

interface FileUploadProps {
  onUploadComplete?: (file: { originalName: string; storedPath: string }) => void
  disabled?: boolean
}

export function FileUpload({ onUploadComplete, disabled }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<{
    originalName: string
    storedPath: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/wiki/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409 && data.duplicate) {
          throw new Error(`文件重复：与「${data.duplicateOf.originalName}」内容相同`)
        }
        throw new Error(data.error || "上传失败")
      }

      const data = await res.json()
      setUploadedFile({ originalName: data.originalName, storedPath: data.storedPath })
      onUploadComplete?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setUploading(false)
      // 重置 input 以允许重复上传同名文件
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleClear = () => {
    setUploadedFile(null)
    setError(null)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".txt,.csv,.md,.json,.pdf,.xlsx,.xls,.docx"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {uploadedFile ? (
        <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
          <FileText className="h-3 w-3" />
          <span className="max-w-32 truncate">{uploadedFile.originalName}</span>
          <button onClick={handleClear} className="ml-1 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClick}
          disabled={disabled || uploading}
          title="上传文件到知识库"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
