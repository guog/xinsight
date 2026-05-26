"use client"

import { useState, useCallback, useRef } from "react"
import { API_BASE } from "@/lib/api"

type FeedbackType = "up" | "down"
type FeedbackMap = Record<string, FeedbackType>

export function useMessageFeedback(chatId: string | null) {
  const [feedbacks, setFeedbacks] = useState<FeedbackMap>({})
  const currentChatIdRef = useRef<string | null>(null)

  const loadFeedbacks = useCallback(async (id: string) => {
    currentChatIdRef.current = id
    try {
      const res = await fetch(`${API_BASE}/api/chats/${id}/feedback`)
      if (res.ok && currentChatIdRef.current === id) {
        const data = await res.json()
        const map: FeedbackMap = {}
        for (const f of data) {
          map[f.messageId] = f.type
        }
        setFeedbacks(map)
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleFeedback = useCallback(
    async (messageId: string, type: FeedbackType) => {
      if (!chatId) return
      const prev = feedbacks[messageId]
      // Optimistic update
      setFeedbacks((f) => {
        const next = { ...f }
        if (prev === type) {
          delete next[messageId]
        } else {
          next[messageId] = type
        }
        return next
      })

      try {
        const res = await fetch(`${API_BASE}/api/chats/${chatId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, type }),
        })
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
      } catch {
        // Revert on error
        setFeedbacks((f) => {
          const next = { ...f }
          if (prev) {
            next[messageId] = prev
          } else {
            delete next[messageId]
          }
          return next
        })
      }
    },
    [chatId, feedbacks],
  )

  return { feedbacks, loadFeedbacks, toggleFeedback }
}
