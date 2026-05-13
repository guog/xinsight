"use client"

import { useState } from "react"
import { Plus, X, Trash2, Search, BookOpen, Settings, Database } from "lucide-react"
import Link from "next/link"
import { useChats } from "@/hooks/use-chats"
import { useUser } from "@/hooks/use-user"

interface MobileChatDrawerProps {
  open: boolean
  onClose: () => void
  activeChatId: string | null
  onNewChat: () => void
  onSelectChat: (chat: { id: string; agentId: string }) => void
  onDeleteChat: (id: string) => void
}

export function MobileChatDrawer({
  open,
  onClose,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: MobileChatDrawerProps) {
  const { chats, loading } = useChats()
  const { user } = useUser()
  const [search, setSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const handleClose = () => {
    setSearch("")
    setConfirmDelete(null)
    onClose()
  }

  const filtered = chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-in slide-in-from-left duration-200">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* 面板 */}
      <div className="relative w-[85%] max-w-sm h-full bg-card border-r border-border flex flex-col safe-top">
        {/* 顶部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">对话</h2>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg active:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 新对话 + 搜索 */}
        <div className="px-4 py-3 space-y-2">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium active:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
            新对话
          </button>
          {chats.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索对话..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-muted/50 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2">
          {loading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? "没有匹配的对话" : "暂无对话"}
            </p>
          ) : (
            filtered.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 px-3 py-3 rounded-xl mb-1 transition-colors ${
                  activeChatId === chat.id
                    ? "bg-primary/10 border border-primary/20"
                    : "active:bg-muted"
                }`}
              >
                <button onClick={() => onSelectChat(chat)} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate" title={chat.title || "新对话"}>
                    {chat.title || "新对话"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(chat.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </button>
                {confirmDelete === chat.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onDeleteChat(chat.id)
                        setConfirmDelete(null)
                      }}
                      className="px-2 py-1 text-xs rounded bg-destructive text-destructive-foreground"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-xs rounded bg-muted"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(chat.id)}
                    className="p-2 rounded-lg text-muted-foreground active:text-destructive active:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* 导航 */}
        <div className="shrink-0 border-t border-border px-4 py-3 space-y-1 safe-bottom">
          <Link
            href="/wiki"
            onClick={handleClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm active:bg-muted transition-colors"
          >
            <BookOpen className="size-4 text-muted-foreground" />
            知识库
          </Link>
          <Link
            href="/settings"
            onClick={handleClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm active:bg-muted transition-colors"
          >
            <Settings className="size-4 text-muted-foreground" />
            设置
          </Link>
          {user?.role === "admin" && (
            <Link
              href="/admin/datasources"
              onClick={handleClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm active:bg-muted transition-colors"
            >
              <Database className="size-4 text-muted-foreground" />
              管理后台
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
