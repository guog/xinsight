"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Pencil, Trash2, Search, Shield } from "lucide-react"
import { toast } from "sonner"
import { useAdminAgents } from "@/hooks/use-admin-agents"
import { ListSkeleton } from "@/components/skeleton"

type TypeFilter = "all" | "builtin" | "custom"

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "builtin", label: "内置" },
  { value: "custom", label: "自定义" },
]

export default function AgentsPage() {
  const { agents, loading, error, refresh, remove, toggleEnabled } = useAdminAgents()
  const [search, setSearch] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")

  const filtered = useMemo(() => {
    return agents.filter((agent) => {
      // type filter
      if (typeFilter === "builtin" && !agent.isBuiltin) return false
      if (typeFilter === "custom" && agent.isBuiltin) return false
      // search filter
      if (search) {
        const q = search.toLowerCase()
        return (
          agent.name.toLowerCase().includes(q) ||
          agent.id.toLowerCase().includes(q) ||
          (agent.description?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [agents, typeFilter, search])

  const handleDelete = async (id: string) => {
    try {
      await remove(id)
      toast.success("Agent 已删除")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleEnabled(id, enabled)
      toast.success(enabled ? "已启用" : "已禁用")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败")
    }
  }

  if (loading) {
    return <ListSkeleton count={6} />
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={refresh} className="text-sm text-primary hover:underline">
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Agent 管理</h2>
          <p className="text-sm text-muted-foreground">
            管理内置和自定义 Agent，启用或禁用、编辑配置。
          </p>
        </div>
        <Link
          href="/admin/agents/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          新建 Agent
        </Link>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索 Agent 名称、ID 或描述..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent 卡片网格 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-sm text-muted-foreground">暂无匹配的 Agent</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <div
              key={agent.id}
              className="bg-card border border-border rounded-xl p-4 space-y-3 transition-shadow duration-200 hover:shadow-md"
            >
              {/* 头部：图标、名称、ID、内置标记 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{agent.icon || "🤖"}</span>
                  <div>
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.id}</div>
                  </div>
                </div>
                {agent.isBuiltin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    <Shield className="size-3" />
                    内置
                  </span>
                )}
              </div>

              {/* 启用开关 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {agent.enabled ? "已启用" : "已禁用"}
                </span>
                <button
                  onClick={() => handleToggle(agent.id, !agent.enabled)}
                  disabled={agent.isBuiltin}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    agent.enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      agent.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* 描述 */}
              {agent.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                {agent.isBuiltin ? (
                  <Link
                    href={`/admin/agents/${agent.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    查看详情
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`/admin/agents/${agent.id}/edit`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="size-3" />
                      编辑
                    </Link>
                    {deleteConfirm === agent.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          确认删除
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(agent.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
                      >
                        <Trash2 className="size-3" />
                        删除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
