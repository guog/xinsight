"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Settings,
  Database,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Trash2,
} from "lucide-react"
import Link from "next/link"

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
  const [chatList, setChatList] = useState<ChatItem[]>([])

  // 加载对话列表
  useEffect(() => {
    fetch(`${apiBase}/api/chats`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setChatList(data))
      .catch(() => {})
  }, [activeChatId]) // activeChatId 变化时刷新

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (onDeleteChat) {
      onDeleteChat(id)
      setChatList((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* 顶部 */}
      <div className="p-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">xinsight</span>
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
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <Plus className="size-4" />
          新对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {chatList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">暂无对话</p>
        ) : (
          chatList.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                onSelectChat(chat)
                setIsMobileOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors group ${
                activeChatId === chat.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <MessageSquare className="size-3.5 shrink-0" />
              <span className="truncate flex-1 text-left">{chat.title}</span>
              {onDeleteChat && (
                <button
                  onClick={(e) => handleDelete(e, chat.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                  title="删除对话"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </button>
          ))
        )}
      </div>

      {/* 底部导航 */}
      <div className="p-3 border-t border-border space-y-1">
        <Link
          href="/admin/datasources"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
          onClick={() => setIsMobileOpen(false)}
        >
          <Database className="size-4" />
          数据源管理
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
          onClick={() => setIsMobileOpen(false)}
        >
          <Settings className="size-4" />
          设置
        </Link>
      </div>
    </div>
  )

  return (
    <>
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
        <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-card h-dvh">
          {sidebarContent}
        </aside>
      )}

      {/* 移动端抽屉遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        >
          <aside
            className="w-72 h-full bg-card border-r border-border"
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
