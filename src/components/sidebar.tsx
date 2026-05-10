"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Plus,
  Settings,
  BookOpen,
  Database,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  LogOut,
  Search,
  Mic,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { API_BASE } from "@/lib/api"
import { useUser } from "@/hooks/use-user"
import { useSwipe } from "@/hooks/use-swipe"

interface ChatItem {
  id: string
  title: string
  agentId: string
  updatedAt: string
}

interface SidebarProps {
  activeChatId?: string | null
  onNewChat: () => void
  onSelectChat: (chat: ChatItem) => void
  onDeleteChat?: (id: string) => void
}

const apiBase =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : ""

export function Sidebar({ activeChatId, onNewChat, onSelectChat, onDeleteChat }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // 手势支持：从左边缘右滑打开侧边栏
  const openSidebar = useCallback(() => setIsMobileOpen(true), [])
  const closeSidebar = useCallback(() => setIsMobileOpen(false), [])
  const swipeHandlers = useSwipe({
    onSwipeRight: openSidebar,
    onSwipeLeft: closeSidebar,
  })
  const [chatList, setChatList] = useState<ChatItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user, isAdmin } = useUser()

  // 加载对话列表
  useEffect(() => {
    fetch(`${apiBase}/api/chats`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setChatList(data))
      .catch(() => {})
  }, [activeChatId]) // activeChatId 变化时刷新

  // 重命名对话
  const handleRename = async (id: string) => {
    const trimmed = editTitle.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    try {
      await fetch(`${apiBase}/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      })
      setChatList((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)))
    } catch {}
    setEditingId(null)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm("确定要删除这个对话吗？")) return
    if (onDeleteChat) {
      onDeleteChat(id)
      setChatList((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* 顶部 */}
      <div className="p-3 flex items-center justify-between">
        <span className="text-base font-bold tracking-tight text-foreground">xinsight</span>
        <button
          onClick={() => {
            setIsOpen(false)
            setIsMobileOpen(false)
          }}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors hidden md:block"
          title="收起侧边栏"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* 新建对话按钮 */}
      <div className="px-3 mb-2">
        <button
          onClick={() => {
            onNewChat()
            setIsMobileOpen(false)
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm"
        >
          <Plus className="size-4" />
          新对话
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 mb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {chatList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">暂无对话</p>
        ) : (
          chatList
            .filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((chat) => (
              <div
                role="button"
                tabIndex={0}
                key={chat.id}
                onClick={() => {
                  if (editingId !== chat.id) {
                    onSelectChat(chat)
                    setIsMobileOpen(false)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelectChat(chat)
                    setIsMobileOpen(false)
                  }
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 group ${
                  activeChatId === chat.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                } cursor-pointer`}
              >
                <MessageSquare className="size-3.5 shrink-0" />
                {editingId === chat.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleRename(chat.id)
                      } else if (e.key === "Escape") {
                        setEditingId(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-sm bg-background border border-border rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                ) : (
                  <span
                    className="truncate flex-1 text-left"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingId(chat.id)
                      setEditTitle(chat.title)
                    }}
                  >
                    {chat.title}
                  </span>
                )}
                {onDeleteChat && editingId !== chat.id && (
                  <button
                    onClick={(e) => handleDelete(e, chat.id)}
                    className="opacity-0 group-hover:opacity-100 touch-show p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity duration-200"
                    title="删除对话"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))
        )}
      </div>

      {/* 底部导航 */}
      <div className="p-3 border-t border-border space-y-1">
        {user && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
              {(user.displayName || user.username).charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate">
              {user.displayName || user.username}
            </span>
          </div>
        )}
        {isAdmin && (
          <Link
            href="/admin/datasources"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-all duration-150"
            onClick={() => setIsMobileOpen(false)}
          >
            <Database className="size-4" />
            数据源管理
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/voice"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-all duration-150"
            onClick={() => setIsMobileOpen(false)}
          >
            <Mic className="size-4" />
            语音配置
          </Link>
        )}
        <Link
          href="/wiki"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-all duration-150"
          onClick={() => setIsMobileOpen(false)}
        >
          <BookOpen className="size-4" />
          知识库
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-all duration-150"
          onClick={() => setIsMobileOpen(false)}
        >
          <Settings className="size-4" />
          设置
        </Link>
        <button
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" })
            } catch {}
            router.push("/login")
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-all duration-150 w-full text-left text-destructive"
        >
          <LogOut className="size-4" />
          退出登录
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* 移动端手势感应区域（从左边缘右滑打开侧边栏） */}
      <div className="fixed top-0 left-0 w-5 h-full z-30 md:hidden" {...swipeHandlers} />

      {/* 移动端展开按钮（侧边栏关闭时显示） */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors hidden md:block"
          title="展开侧边栏"
        >
          <PanelLeft className="size-4" />
        </button>
      )}

      {/* 移动端汉堡按钮 */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors md:hidden"
        title="打开菜单"
      >
        <PanelLeft className="size-4" />
      </button>

      {/* 桌面端侧边栏 */}
      {isOpen && (
        <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-sidebar h-dvh">
          {sidebarContent}
        </aside>
      )}

      {/* 移动端抽屉遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
        >
          <aside
            className="w-72 h-full bg-sidebar border-r border-border animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

export type { ChatItem }
