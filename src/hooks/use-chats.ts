"use client"

import { useState, useCallback, useSyncExternalStore } from "react"

export interface Chat {
  id: string
  title: string
  agentId: string
  modelId: string | null
  createdAt: string
  updatedAt: string
}

const apiBase =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : ""

/** 简易缓存：避免 useEffect + setState 的 lint 问题 */
let cachedChats: Chat[] = []
let cacheListeners: Array<() => void> = []
let fetchPromise: Promise<void> | null = null
let hasFetched = false
const EMPTY_CHATS: Chat[] = []

function notifyListeners() {
  for (const l of cacheListeners) l()
}

function subscribe(listener: () => void) {
  cacheListeners.push(listener)
  return () => {
    cacheListeners = cacheListeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  return cachedChats
}

function ensureFetched() {
  if (typeof window === "undefined") return
  if (hasFetched || fetchPromise) return
  fetchPromise = fetch(`${apiBase}/api/chats`)
    .then((res) => (res.ok ? res.json() : []))
    .then((data: Chat[]) => {
      cachedChats = data
      hasFetched = true
      notifyListeners()
    })
    .catch((e) => {
      console.error("获取对话列表失败:", e)
    })
    .finally(() => {
      fetchPromise = null
    })
}

/** 清空缓存（用户登出或切换时调用） */
/** 清空缓存（用户登出或切换时调用） */
export function clearChatsCache() {
  cachedChats = []
  fetchPromise = null
  hasFetched = false
  notifyListeners()
}

export function useChats() {
  // 触发首次加载
  ensureFetched()
  const chats = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CHATS)
  const [loading] = useState(() => cachedChats.length === 0 && fetchPromise !== null)

  const createChat = useCallback(
    async (data?: { title?: string; agentId?: string; modelId?: string }) => {
      const res = await fetch(`${apiBase}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
      })
      if (!res.ok) throw new Error("创建对话失败")
      const chat: Chat = await res.json()
      cachedChats = [chat, ...cachedChats]
      notifyListeners()
      return chat
    },
    [],
  )

  const updateChat = useCallback(
    async (id: string, data: Partial<Pick<Chat, "title" | "agentId" | "modelId">>) => {
      const res = await fetch(`${apiBase}/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("更新对话失败")
      const updated: Chat = await res.json()
      cachedChats = cachedChats.map((c) => (c.id === id ? updated : c))
      notifyListeners()
      return updated
    },
    [],
  )

  const deleteChat = useCallback(async (id: string) => {
    const res = await fetch(`${apiBase}/api/chats/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("删除对话失败")
    cachedChats = cachedChats.filter((c) => c.id !== id)
    notifyListeners()
  }, [])

  const refresh = useCallback(async () => {
    if (fetchPromise) return fetchPromise
    fetchPromise = fetch(`${apiBase}/api/chats`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Chat[]) => {
        cachedChats = data
        hasFetched = true
        notifyListeners()
      })
      .catch((e) => {
        console.error("获取对话列表失败:", e)
      })
      .finally(() => {
        fetchPromise = null
      })
    return fetchPromise
  }, [])

  return { chats, loading, createChat, updateChat, deleteChat, refresh }
}
