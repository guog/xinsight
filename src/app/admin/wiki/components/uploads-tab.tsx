"use client"

import { useEffect, useState } from "react"

// 上传管理标签
interface UploadFile {
  path: string
  title: string
  size: number
  modifiedAt: string
  hasExtractedText?: boolean
  tags: string[]
}

export default function UploadsTab() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/wiki/admin/pages?prefix=raw/uploads")
      const data = await res.json()
      setFiles(data.pages || data || [])
    } catch (e) {
      console.error("获取上传文件失败", e)
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchFiles()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = async (path: string) => {
    if (!confirm(`确认删除 ${path}？`)) return
    await fetch(`/api/wiki/admin/pages/${encodeURIComponent(path)}`, { method: "DELETE" })
    fetchFiles()
  }

  const handleReingest = async (path: string) => {
    await fetch("/api/wiki/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ingest", target: path }),
    })
    alert("重新提取任务已创建")
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">文件名</th>
            <th className="p-2">已提取文本</th>
            <th className="p-2">大小</th>
            <th className="p-2">上传时间</th>
            <th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.path} className="border-b hover:bg-gray-50">
              <td className="p-2">{file.title || file.path.split("/").pop()}</td>
              <td className="p-2">
                {file.hasExtractedText ? (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                    已提取
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                    未提取
                  </span>
                )}
              </td>
              <td className="p-2">{(file.size / 1024).toFixed(1)}KB</td>
              <td className="p-2">{new Date(file.modifiedAt).toLocaleString("zh-CN")}</td>
              <td className="p-2 flex gap-1">
                <button
                  onClick={() => handleReingest(file.path)}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                >
                  重新提取
                </button>
                <button
                  onClick={() => handleDelete(file.path)}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {files.length === 0 && <div className="text-center text-gray-400 py-8">暂无上传文件</div>}
    </div>
  )
}
