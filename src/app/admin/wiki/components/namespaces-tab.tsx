"use client"

import { useEffect, useState } from "react"
import { FolderKanban, Plus, Pencil, Trash2, X } from "lucide-react"

interface WikiNamespace {
  id: string
  name: string
  displayName: string
  description: string | null
  createdAt: string
  agentIds: string[]
}

interface AgentOption {
  id: string
  name: string
  icon: string | null
}

export default function NamespacesTab() {
  const [namespaces, setNamespaces] = useState<WikiNamespace[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)

  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNs, setEditingNs] = useState<WikiNamespace | null>(null)

  // 表单状态
  const [name, setName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState("")

  const fetchData = async () => {
    try {
      setLoading(true)
      // 1. 获取分区列表
      const nsRes = await fetch("/api/wiki/admin/namespaces")
      const nsData = await nsRes.json()
      setNamespaces(Array.isArray(nsData) ? nsData : [])

      // 2. 获取 Agent 列表
      const agentRes = await fetch("/api/admin/agents")
      const agentData = await agentRes.json()
      setAgents(Array.isArray(agentData) ? agentData : agentData.agents || [])
    } catch (e) {
      console.error("加载数据失败", e)
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchData()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleOpenCreate = () => {
    setEditingNs(null)
    setName("")
    setDisplayName("")
    setDescription("")
    setSelectedAgentIds([])
    setErrorMsg("")
    setModalOpen(true)
  }

  const handleOpenEdit = (ns: WikiNamespace) => {
    setEditingNs(ns)
    setName(ns.name)
    setDisplayName(ns.displayName)
    setDescription(ns.description || "")
    setSelectedAgentIds(ns.agentIds || [])
    setErrorMsg("")
    setModalOpen(true)
  }

  const handleDelete = async (ns: WikiNamespace) => {
    if (
      !confirm(
        `确认删除分区 "${ns.displayName}"？此操作是不可逆的，且会取消所有挂载的 Agent 绑定。`,
      )
    ) {
      return
    }
    try {
      const res = await fetch(`/api/wiki/admin/namespaces/${ns.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || "删除失败")
      } else {
        void fetchData()
      }
    } catch (e) {
      console.error("删除失败", e)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!name.trim() || !displayName.trim()) {
      setErrorMsg("分区标识和显示名称为必填项")
      return
    }

    const payload = {
      name: name.trim(),
      displayName: displayName.trim(),
      description: description.trim(),
      agentIds: selectedAgentIds,
    }

    try {
      const url = editingNs
        ? `/api/wiki/admin/namespaces/${editingNs.id}`
        : "/api/wiki/admin/namespaces"
      const method = editingNs ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || "保存失败")
      } else {
        setModalOpen(false)
        void fetchData()
      }
    } catch (err) {
      setErrorMsg("网络请求错误")
      console.error(err)
    }
  }

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 text-muted-foreground text-sm animate-pulse">
        数据加载中...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground text-sm">
          设置知识库目录分区，并将不同分区挂载到对应 Agent，实现多 Agent 独立背景知识检索隔离。
        </p>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg border font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="size-4" />
          新建分区
        </button>
      </div>

      {/* 分区表格 */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-3 font-semibold">显示名称</th>
              <th className="p-3 font-semibold">分区标识</th>
              <th className="p-3 font-semibold">物理子目录</th>
              <th className="p-3 font-semibold">挂载 Agent</th>
              <th className="p-3 font-semibold">描述</th>
              <th className="p-3 font-semibold">创建时间</th>
              <th className="p-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {namespaces.map((ns) => (
              <tr key={ns.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium text-foreground">{ns.displayName}</td>
                <td className="p-3 font-mono text-xs text-primary">{ns.name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">wiki/{ns.name}/</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {ns.agentIds?.length > 0 ? (
                      ns.agentIds.map((agentId) => {
                        const agent = agents.find((a) => a.id === agentId)
                        return (
                          <span
                            key={agentId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border"
                          >
                            <span>{agent?.icon || "🤖"}</span>
                            <span>{agent?.name || agentId}</span>
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-muted-foreground text-xs italic">无绑定 (仅公共)</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                  {ns.description || "暂无描述"}
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {new Date(ns.createdAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(ns)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="编辑分区"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ns)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                      title="删除分区"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {namespaces.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                  暂无任何分区配置，全部 Agent 均检索全局公共 Wiki 页面。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 创建 / 编辑模态弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FolderKanban className="size-5 text-primary" />
                <h3 className="font-semibold text-lg text-foreground">
                  {editingNs ? "编辑分区" : "新建分区"}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-lg flex items-center gap-2">
                  <span className="font-bold">⚠️ 提示:</span> {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  分区标识 (物理子目录名)
                </label>
                <input
                  type="text"
                  placeholder="e.g. energy (对应 wiki/energy/ 目录)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-mono"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                  }
                  disabled={!!editingNs}
                  required
                />
                {!editingNs && (
                  <p className="text-[11px] text-muted-foreground">
                    仅限英文小写、数字、短横线。保存后**不可修改**，作为文件夹相对路径。
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  分区显示名称
                </label>
                <input
                  type="text"
                  placeholder="e.g. 能源管理知识库"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  描述 (选填)
                </label>
                <textarea
                  placeholder="输入此分区知识库的内容描述"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  挂载的 Agent (多选)
                </label>
                <div className="border border-border rounded-xl p-3 bg-muted/20 max-h-[160px] overflow-y-auto grid grid-cols-2 gap-2">
                  {agents.map((agent) => {
                    const isChecked = selectedAgentIds.includes(agent.id)
                    return (
                      <div
                        key={agent.id}
                        onClick={() => handleToggleAgent(agent.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:bg-muted bg-card"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // 采用父级 div 点击联动控制
                          className="pointer-events-none size-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-base">{agent.icon || "🤖"}</span>
                        <span className="font-medium truncate">{agent.name}</span>
                      </div>
                    )
                  })}
                  {agents.length === 0 && (
                    <div className="col-span-2 text-center text-muted-foreground py-4 text-xs italic">
                      无可用 Agent 供挂载。请在 Agent 管理中创建。
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  勾选后，绑定的 Agent 执行 wiki-search 与 wiki-list
                  时将被**强制隔离**在当前目录下。
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/90 border rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
