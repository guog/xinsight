/**
 * 本地存储工具 — 管理对话历史、模型设置、主题等
 *
 * 注意：此文件中的类型是客户端 localStorage 专用。
 * DB 层的对话消息使用 `parts: JSON string`（UIMessage.parts），
 * 与此处的 `content: string` 不同。客户端仅用于离线草稿缓存。
 */

export interface Conversation {
  id: string
  title: string
  messages: ConversationMessage[]
  modelId?: string
  agentId?: string
  createdAt: number
  updatedAt: number
}

/**
 * 客户端消息类型（localStorage 离线草稿）
 *
 * 与 DB 层 messages 表结构不同：
 * - DB: `parts` (JSON string, UIMessage.parts 格式)
 * - 客户端: `content` (纯文本，用于简单缓存)
 */
export interface ConversationMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
}

const KEYS = {
  MODEL_ID: "xinsight:modelId",
  CONVERSATIONS: "xinsight:conversations",
  THEME: "xinsight:theme",
} as const

// --- 模型设置 ---

export function getStoredModelId(): string | null {
  return localStorage.getItem(KEYS.MODEL_ID)
}

export function setStoredModelId(modelId: string): void {
  localStorage.setItem(KEYS.MODEL_ID, modelId)
}

// --- 对话历史 ---

export function getConversations(): Conversation[] {
  const raw = localStorage.getItem(KEYS.CONVERSATIONS)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Conversation[]
  } catch {
    return []
  }
}

export function saveConversation(conv: Conversation): void {
  const convs = getConversations()
  const idx = convs.findIndex((c) => c.id === conv.id)
  if (idx >= 0) {
    convs[idx] = conv
  } else {
    convs.push(conv)
  }
  localStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(convs))
}

export function deleteConversation(id: string): void {
  const convs = getConversations().filter((c) => c.id !== id)
  localStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(convs))
}

// --- 主题 ---

export type Theme = "light" | "dark" | "system"

export function getStoredTheme(): Theme {
  return (localStorage.getItem(KEYS.THEME) as Theme) ?? "system"
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(KEYS.THEME, theme)
}
