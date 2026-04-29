"use client"

import { useEffect, useState } from "react"

// Wiki 页面管理标签
interface WikiPage {
  path: string
  title: string
  type: string
  tags: string[]
  size: number
  modifiedAt: string
}

export default function PagesTab() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<WikiPage | null>(null)
  const [content, setContent] = useState("")

  const fetchPages = async () => {
    try {
      const res = await fetch("/api/wiki/admin/pages")
      const data = await res.json()
      setPages(data.pages || data || [])
    } catch (e) {
      console.error("获取页面失败", e)
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchPages()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = async (path: string) => {
    if (!confirm(`确认删除 ${path}？`)) return
    await fetch(`/api/wiki/admin/pages/${encodeURIComponent(path)}`, { method: "DELETE" })
    fetchPages()
  }

  const handleEdit = async (page: WikiPage) => {
    setEditing(page)
    const res = await fetch(`/api/wiki/admin/pages/${encodeURIComponent(page.path)}`)
    const data = await res.json()
    setContent(data.content || "")
  }

  const handleSave = async () => {
    if (!editing) return
    await fetch(`/api/wiki/admin/pages/${encodeURIComponent(editing.path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
    setEditing(null)
    fetchPages()
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      {/* 编辑模态框 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] flex flex-col">
            <h3 className="font-bold mb-2">编辑: {editing.path}</h3>
            <textarea
              className="flex-1 border rounded p-2 font-mono text-sm min-h-[300px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-200 rounded">
                取消
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">路径</th>
            <th className="p-2">标题</th>
            <th className="p-2">类型</th>
            <th className="p-2">标签</th>
            <th className="p-2">大小</th>
            <th className="p-2">修改时间</th>
            <th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.path} className="border-b hover:bg-gray-50">
              <td className="p-2 font-mono text-xs">{page.path}</td>
              <td className="p-2">{page.title}</td>
              <td className="p-2">{page.type}</td>
              <td className="p-2">{page.tags?.join(", ")}</td>
              <td className="p-2">{(page.size / 1024).toFixed(1)}KB</td>
              <td className="p-2">{new Date(page.modifiedAt).toLocaleString("zh-CN")}</td>
              <td className="p-2 flex gap-1">
                <button
                  onClick={() => handleEdit(page)}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(page.path)}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pages.length === 0 && <div className="text-center text-gray-400 py-8">暂无页面</div>}
    </div>
  )
}
