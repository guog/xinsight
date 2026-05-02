"use client"

import { useEffect, useState, useCallback } from "react"

// 上传记录类型（对应 wikiUploads 表）
interface UploadRecord {
  id: string
  originalName: string
  storedPath: string
  mimeType: string
  size: number
  sha256: string
  status: "pending" | "ingesting" | "completed" | "failed" | "invalid"
  ingestProgress: number
  ingestError: string | null
  invalidReason: string | null
  pagesCreated: string | null
  source: string
  uploadedAt: string
  ingestedAt: string | null
  createdAt: string
  updatedAt: string
}

interface WikiSettings {
  autoIngest?: string
  [key: string]: string | undefined
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "待摄入", cls: "bg-yellow-100 text-yellow-700" },
  ingesting: { label: "摄入中", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "已完成", cls: "bg-green-100 text-green-700" },
  failed: { label: "失败", cls: "bg-red-100 text-red-700" },
  invalid: { label: "无效", cls: "bg-gray-100 text-gray-500" },
}

export default function UploadsTab() {
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [settings, setSettings] = useState<WikiSettings>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [uploadsRes, settingsRes] = await Promise.all([
        fetch("/api/wiki/admin/uploads"),
        fetch("/api/wiki/admin/settings"),
      ])
      const uploadsData = await uploadsRes.json()
      const settingsData = await settingsRes.json()
      setUploads(uploadsData.uploads || [])
      setSettings(settingsData.settings || {})
    } catch (e) {
      console.error("获取数据失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchData()
  }, [fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleIngest = async (id: string) => {
    await fetch(`/api/wiki/admin/uploads/${id}/ingest`, { method: "POST" })
    void fetchData()
  }

  const handleToggleAutoIngest = async () => {
    const newValue = settings.autoIngest === "true" ? "false" : "true"
    await fetch("/api/wiki/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoIngest: newValue }),
    })
    void fetchData()
  }

  if (loading) return <div>加载中...</div>

  return (
    <div className="space-y-4">
      {/* 设置区域 */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
        <span className="text-sm font-medium">自动摄入</span>
        <button
          onClick={handleToggleAutoIngest}
          className={`px-3 py-1 rounded text-xs font-medium ${
            settings.autoIngest === "true" ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"
          }`}
        >
          {settings.autoIngest === "true" ? "已开启" : "已关闭"}
        </button>
        <span className="text-xs text-gray-500">开启后新上传/发现的文件将自动摄入到知识库</span>
      </div>

      {/* 上传列表 */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">文件名</th>
            <th className="p-2">来源</th>
            <th className="p-2">状态</th>
            <th className="p-2">进度</th>
            <th className="p-2">大小</th>
            <th className="p-2">上传时间</th>
            <th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((upload) => {
            const statusInfo = STATUS_MAP[upload.status] || STATUS_MAP.pending
            return (
              <tr key={upload.id} className="border-b hover:bg-gray-50">
                <td className="p-2" title={upload.storedPath}>
                  {upload.originalName}
                </td>
                <td className="p-2 text-xs text-gray-500">{upload.source}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                  {upload.ingestError && (
                    <span className="block text-xs text-red-500 mt-1" title={upload.ingestError}>
                      {upload.ingestError.slice(0, 50)}
                    </span>
                  )}
                  {upload.invalidReason && (
                    <span className="block text-xs text-gray-500 mt-1">{upload.invalidReason}</span>
                  )}
                </td>
                <td className="p-2">
                  {upload.status === "ingesting" && (
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${upload.ingestProgress}%` }}
                      />
                    </div>
                  )}
                  {upload.status === "completed" && (
                    <span className="text-xs text-green-600">100%</span>
                  )}
                </td>
                <td className="p-2 text-xs">{(upload.size / 1024).toFixed(1)}KB</td>
                <td className="p-2 text-xs">
                  {new Date(upload.uploadedAt).toLocaleString("zh-CN")}
                </td>
                <td className="p-2">
                  {(upload.status === "pending" || upload.status === "failed") && (
                    <button
                      onClick={() => handleIngest(upload.id)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                    >
                      摄入
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {uploads.length === 0 && <div className="text-center text-gray-400 py-8">暂无上传记录</div>}
    </div>
  )
}
