"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, FileText, AlertCircle } from "lucide-react"

interface WikiPage {
  path: string
  title: string
  type: string
  tags: string[]
  size: number
  modifiedAt: string
  namespace: string | null
}

interface WikiNamespace {
  id: string
  name: string
  displayName: string
}

export default function PagesTab() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [namespaces, setNamespaces] = useState<WikiNamespace[]>([])
  const [loading, setLoading] = useState(true)

  // 编辑模态框
  const [editing, setEditing] = useState<WikiPage | null>(null)
  const [content, setContent] = useState("")

  // 新建页面模态框
  const [createOpen, setCreateOpen] = useState(false)
  const [newPath, setNewPath] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newNamespace, setNewNamespace] = useState("")
  const [newContent, setNewContent] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const fetchPages = async () => {
    try {
      const res = await fetch("/api/wiki/admin/pages")
      const data = await res.json()
      setPages(Array.isArray(data) ? data : data.pages || [])
    } catch (e) {
      console.error("获取页面失败", e)
    }
  }

  const fetchNamespaces = async () => {
    try {
      const res = await fetch("/api/wiki/admin/namespaces")
      const data = await res.json()
      setNamespaces(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("获取分区失败", e)
    }
  }

  const initData = async () => {
    setLoading(true)
    await Promise.all([fetchPages(), fetchNamespaces()])
    setLoading(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    void initData()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleDelete = async (path: string) => {
    if (!confirm(`确认删除 ${path}？`)) return
    await fetch("/api/wiki/admin/pages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    })
    void fetchPages()
  }

  const handleEdit = async (page: WikiPage) => {
    setEditing(page)
    const res = await fetch(`/api/wiki/admin/pages/${encodeURIComponent(page.path)}`)
    const data = await res.json()
    setContent(data.content || "")
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    await fetch(`/api/wiki/admin/pages/${encodeURIComponent(editing.path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
    setEditing(null)
    void fetchPages()
  }

  const handleOpenCreate = () => {
    setNewPath("")
    setNewTitle("")
    setNewNamespace("")
    setNewContent("---\ntitle: 新建文档\ntype: note\ntags: []\n---\n\n在这里开始输入正文...")
    setErrorMsg("")
    setCreateOpen(true)
  }

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!newPath.trim()) {
      setErrorMsg("文件名/相对路径不能为空")
      return
    }

    // 格式化后缀名
    let formattedPath = newPath.trim()
    if (!formattedPath.endsWith(".md") && !formattedPath.endsWith(".mdx")) {
      formattedPath += ".md"
    }

    // 组合成含 Frontmatter 的完整内容
    let finalContent = newContent
    // 如果用户输入了标题，且 newContent 中有 title 占位符，自动替换它
    if (newTitle.trim()) {
      finalContent = newContent.replace("title: 新建文档", `title: ${newTitle.trim()}`)
    }

    try {
      const res = await fetch("/api/wiki/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: formattedPath,
          content: finalContent,
          namespace: newNamespace || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || "创建失败")
      } else {
        setCreateOpen(false)
        void fetchPages()
      }
    } catch (err) {
      setErrorMsg("网络请求错误")
      console.error(err)
    }
  }

  if (loading)
    return <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>

  return (
    <div className="space-y-4">
      {/* 顶部控制栏 */}
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground text-sm">
          管理本地 Markdown Wiki 页面，你可以直接在线创建新页面或编辑现有的知识文档。
        </p>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg border font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="size-4" />
          新建页面
        </button>
      </div>

      {/* 编辑模态框 */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                <h3 className="font-semibold text-lg text-foreground">编辑页面</h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {editing.path}
              </span>
            </div>
            <textarea
              className="flex-1 border border-border rounded-xl p-3 font-mono text-sm min-h-[400px] mt-4 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex gap-3 mt-4 justify-end pt-4 border-t border-border">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/90 border rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建页面模态框 */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-primary" />
                <h3 className="font-semibold text-lg text-foreground">新建 Wiki 页面</h3>
              </div>
            </div>

            <form
              onSubmit={handleCreatePage}
              className="flex-1 overflow-y-auto py-4 space-y-4 pr-1"
            >
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    所属分区
                  </label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newNamespace}
                    onChange={(e) => setNewNamespace(e.target.value)}
                  >
                    <option value="">公共分区 (不隔离)</option>
                    {namespaces.map((ns) => (
                      <option key={ns.id} value={ns.name}>
                        {ns.displayName} ({ns.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    路径或文件名
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. intro.md 或 subfolder/page.md"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value.replace(/[^a-zA-Z0-9_./-]/g, ""))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  文档标题 (写入 frontmatter)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 太阳能电池板技术指标"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  文档正文内容 (Markdown)
                </label>
                <textarea
                  className="w-full border border-border rounded-lg p-3 font-mono text-sm min-h-[220px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/90 border rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
                >
                  创建页面
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 页面列表 */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-3 font-semibold">文件名/路径</th>
              <th className="p-3 font-semibold">标题</th>
              <th className="p-3 font-semibold">所属分区</th>
              <th className="p-3 font-semibold">类型</th>
              <th className="p-3 font-semibold">标签</th>
              <th className="p-3 font-semibold">大小</th>
              <th className="p-3 font-semibold">修改时间</th>
              <th className="p-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.path} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono text-xs text-primary">{page.path}</td>
                <td className="p-3 font-medium text-foreground">{page.title}</td>
                <td className="p-3">
                  {page.namespace ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {namespaces.find((n) => n.name === page.namespace)?.displayName ||
                        page.namespace}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                      公共
                    </span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground text-xs">{page.type}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {page.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {(page.size / 1024).toFixed(1)} KB
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {new Date(page.modifiedAt).toLocaleString("zh-CN")}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => handleEdit(page)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="编辑图文内容"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(page.path)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                      title="删除文档"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground italic">
                  暂无任何知识库页面，点击右上角新建一个。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
