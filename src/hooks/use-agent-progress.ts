"use client"

import { createContext, useContext, useCallback, useRef, useSyncExternalStore } from "react"

/**
 * 子 Agent 流式进度管理器
 *
 * 通过 transient data-agent-progress 事件累积子 Agent 文本，
 * 使用 useSyncExternalStore 精确订阅单个 runId，避免全局 re-render。
 */

export interface AgentProgressStore {
  /** 追加文本增量 */
  append(runId: string, textDelta: string): void
  /** 获取当前累积文本 */
  getText(runId: string): string
  /** 清空所有进度（新对话时调用） */
  clear(): void
  /** 订阅某个 runId 的变化（供 useSyncExternalStore） */
  subscribe(runId: string, callback: () => void): () => void
}

export function createAgentProgressStore(): AgentProgressStore {
  const texts = new Map<string, string>()
  const listeners = new Map<string, Set<() => void>>()

  function notify(runId: string) {
    const set = listeners.get(runId)
    if (set) {
      for (const cb of set) cb()
    }
  }

  return {
    append(runId, textDelta) {
      const prev = texts.get(runId) ?? ""
      texts.set(runId, prev + textDelta)
      notify(runId)
    },
    getText(runId) {
      return texts.get(runId) ?? ""
    },
    clear() {
      texts.clear()
      // 通知所有订阅者
      for (const [, set] of listeners) {
        for (const cb of set) cb()
      }
    },
    subscribe(runId, callback) {
      let set = listeners.get(runId)
      if (!set) {
        set = new Set()
        listeners.set(runId, set)
      }
      set.add(callback)
      return () => {
        set!.delete(callback)
        if (set!.size === 0) listeners.delete(runId)
      }
    },
  }
}

export const AgentProgressContext = createContext<AgentProgressStore | null>(null)

/**
 * 订阅单个子 Agent 的流式文本（仅该 runId 变化时 re-render）
 */
export function useAgentStreamingText(runId: string | undefined): string {
  const store = useContext(AgentProgressContext)
  const stableRunId = runId ?? ""

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!store || !stableRunId) return () => {}
      return store.subscribe(stableRunId, callback)
    },
    [store, stableRunId],
  )

  const getSnapshot = useCallback(() => {
    if (!store || !stableRunId) return ""
    return store.getText(stableRunId)
  }, [store, stableRunId])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
