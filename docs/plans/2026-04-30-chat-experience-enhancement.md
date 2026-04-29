# 对话体验 + 数据源展示 + Markdown 渲染 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 完善聊天页面核心体验：停止生成、重新生成、对话搜索/重命名、Tool 调用可视化、Markdown 渲染优化。

**Architecture:**

- 前端：扩展 `src/app/page.tsx` 的消息渲染逻辑，新增 tool-invocation part 渲染组件
- 前端：利用 useChat 已有的 `stop` / `regenerate` 方法，添加 UI 按钮
- 前端：侧边栏增加搜索 + 重命名功能
- 后端：添加 PATCH /api/chats/[id] 支持标题更新
- Markdown：已有 streamdown 集成，确认渲染效果正常即可

**Tech Stack:** Next.js 16 App Router, Bun, TypeScript, Vercel AI SDK v6, streamdown, Tailwind CSS

---

## Phase 1: 停止生成 + 重新生成

### Task 1: 添加停止生成按钮

**Objective:** 流式输出时显示 Stop 按钮，点击终止生成

**Files:**

- Modify: `src/app/page.tsx`

**实现：**

从 `useChat` 解构 `stop`：

```typescript
const { messages, sendMessage, status, setMessages, stop } = useChat({...})
```

在 `PromptInputSubmit` 旁或替换其行为——当 `status === "streaming"` 时显示停止按钮：

```tsx
{
  status === "streaming" ? (
    <button
      onClick={() => stop()}
      className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
      title="停止生成"
    >
      <Square className="size-4" />
    </button>
  ) : (
    <PromptInputSubmit status="ready" disabled={!input.trim()} />
  )
}
```

引入 `Square` 图标（来自 lucide-react）。

### Task 2: 添加重新生成按钮

**Objective:** Assistant 最后一条消息旁显示"重新生成"按钮

**Files:**

- Modify: `src/app/page.tsx`

**实现：**

从 `useChat` 解构 `regenerate`：

```typescript
const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({...})
```

在消息列表中，最后一条 assistant 消息的 `<MessageContent>` 下方添加：

```tsx
{
  message.role === "assistant" && index === messages.length - 1 && status !== "streaming" && (
    <button
      onClick={() => regenerate()}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
    >
      <RotateCcw className="size-3" />
      重新生成
    </button>
  )
}
```

---

## Phase 2: 对话搜索 + 重命名

### Task 3: 侧边栏对话搜索

**Objective:** 侧边栏顶部添加搜索框，按标题过滤对话列表

**Files:**

- Modify: `src/components/sidebar.tsx`

**实现：**

在"新对话"按钮下方添加搜索输入框：

```tsx
const [searchQuery, setSearchQuery] = useState("")

// 在 JSX 中
<div className="px-3 mb-2">
  <input
    type="text"
    placeholder="搜索对话..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
  />
</div>
```

对话列表渲染时过滤：

```typescript
const filteredChats = chatList.filter((chat) =>
  chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
)
```

### Task 4: 对话重命名

**Objective:** 侧边栏双击对话标题进入编辑模式，回车/失焦保存

**Files:**

- Modify: `src/components/sidebar.tsx`
- Create: `src/app/api/chats/[id]/route.ts`（如果 PATCH 不存在则添加）

**实现：**

前端：添加编辑状态：

```tsx
const [editingId, setEditingId] = useState<string | null>(null)
const [editTitle, setEditTitle] = useState("")

// 双击进入编辑
onDoubleClick={() => {
  setEditingId(chat.id)
  setEditTitle(chat.title)
}}

// 编辑态渲染
{editingId === chat.id ? (
  <input
    value={editTitle}
    onChange={(e) => setEditTitle(e.target.value)}
    onBlur={() => handleRename(chat.id, editTitle)}
    onKeyDown={(e) => {
      if (e.key === "Enter") handleRename(chat.id, editTitle)
      if (e.key === "Escape") setEditingId(null)
    }}
    autoFocus
    className="flex-1 bg-transparent border-b border-primary outline-none text-sm"
  />
) : (
  <span className="truncate flex-1 text-left">{chat.title}</span>
)}
```

handleRename 调用 PATCH API：

```typescript
const handleRename = async (id: string, title: string) => {
  setEditingId(null)
  if (!title.trim()) return
  await fetch(`${apiBase}/api/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.trim() }),
  })
  setChatList((prev) => prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c)))
}
```

后端 PATCH（如果 `src/app/api/chats/[id]/route.ts` 已存在则补充 PATCH handler）：

```typescript
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { title } = await req.json()
  if (!title || typeof title !== "string") {
    return Response.json({ error: "title is required" }, { status: 400 })
  }
  await db.update(chats).set({ title, updatedAt: new Date() }).where(eq(chats.id, id))
  return Response.json({ success: true })
}
```

---

## Phase 3: Tool 调用可视化

### Task 5: 创建 ToolInvocation 展示组件

**Objective:** 新建组件渲染 tool-invocation part（调用中/成功/失败状态）

**Files:**

- Create: `src/components/tool-invocation.tsx`

**实现：**

```tsx
"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Database } from "lucide-react"

interface ToolInvocationProps {
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: Record<string, unknown>
  result?: unknown
}

export function ToolInvocation({ toolName, state, args, result }: ToolInvocationProps) {
  const [expanded, setExpanded] = useState(false)

  // 从 toolName 提取更友好的显示名称
  const displayName = toolName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors rounded-lg"
      >
        {state === "result" ? (
          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
        ) : state === "call" || state === "partial-call" ? (
          <Loader2 className="size-4 text-blue-500 animate-spin shrink-0" />
        ) : (
          <XCircle className="size-4 text-destructive shrink-0" />
        )}
        <Database className="size-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left font-medium">
          {state === "result" ? `已查询: ${displayName}` : `正在查询: ${displayName}...`}
        </span>
        {state === "result" &&
          (expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
      </button>

      {expanded && state === "result" && (
        <div className="px-3 pb-3 space-y-2">
          {args && (
            <div>
              <span className="text-xs text-muted-foreground">参数:</span>
              <pre className="mt-1 text-xs bg-background rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <span className="text-xs text-muted-foreground">结果:</span>
            <pre className="mt-1 text-xs bg-background rounded p-2 overflow-x-auto max-h-48">
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

### Task 6: 在 page.tsx 中渲染 tool-invocation parts

**Objective:** message.parts 中 type 为 "tool-invocation" 的 part 用 ToolInvocation 组件渲染

**Files:**

- Modify: `src/app/page.tsx`

**实现：**

在文件顶部引入：

```typescript
import { ToolInvocation } from "@/components/tool-invocation"
```

在 `message.parts.map` 的 switch 中添加 case：

```tsx
case "tool-invocation": {
  const toolPart = part as unknown as {
    toolInvocation: {
      toolName: string
      state: "call" | "partial-call" | "result"
      args?: Record<string, unknown>
      result?: unknown
    }
  }
  const inv = toolPart.toolInvocation
  return (
    <ToolInvocation
      key={`${message.id}-${i}-tool`}
      toolName={inv.toolName}
      state={inv.state}
      args={inv.args}
      result={inv.result}
    />
  )
}
```

### Task 7: 确保后端 stream 传递 tool invocation parts

**Objective:** 验证 Mastra + toAISdkStream 是否已将 tool-call/tool-result 事件转为 UI parts

**Files:**

- Modify: `src/app/api/chat/route.ts`（如需修改）

**实现：**

检查 `toAISdkStream` 是否默认传递 tool 相关 chunk。在 writer.write(value) 之前不要过滤 tool 事件。当前代码已直接 `await writer.write(value)` 不做过滤，应该已包含 tool 事件。

如果测试发现 tool parts 未到达前端，需在 `createUIMessageStream` 配置中确认 `sendToolResults: true` 或类似选项。

---

## Phase 4: Markdown 渲染确认 + 代码块复制

### Task 8: 验证 Streamdown 渲染效果

**Objective:** 确认 streamdown 已正确渲染 MD（代码高亮、表格、列表等）

**验证：** streamdown 已安装并配置了 `code`、`math`、`mermaid`、`cjk` 插件。`MessageResponse` 组件已在使用。此项主要是验证而非新开发。

### Task 9: 代码块添加复制按钮

**Objective:** 代码块右上角显示"复制"按钮

**Files:**

- Create: `src/components/code-block-copy.tsx`
- 可能需要 streamdown 自定义 renderer 或 CSS hack

**实现方案：**

streamdown 的 `@streamdown/code` 插件渲染 `<pre><code>` 结构。通过全局 CSS + JS 为代码块注入复制按钮：

```tsx
// src/components/code-block-copy.tsx
"use client"

import { useEffect } from "react"
import { Check, Copy } from "lucide-react"

export function CodeBlockCopyProvider() {
  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("[data-copy-code]")
      if (!btn) return
      const pre = btn.closest("pre")
      const code = pre?.querySelector("code")?.textContent ?? ""
      await navigator.clipboard.writeText(code)
      btn.setAttribute("data-copied", "true")
      setTimeout(() => btn.removeAttribute("data-copied"), 2000)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return null
}
```

配合 CSS 在 `globals.css` 中添加：

```css
/* 代码块复制按钮 */
.streamdown pre {
  position: relative;
}
.streamdown pre::after {
  content: "复制";
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
.streamdown pre:hover::after {
  opacity: 1;
}
```

> 注意：纯 CSS `::after` 伪元素无法绑定点击事件。更可靠的方案是在 `page.tsx` 用 `useEffect` + MutationObserver 为每个 `<pre>` 注入复制按钮 DOM。具体实现根据 streamdown 的 DOM 结构适配。

---

## 实现顺序

1. Task 1 + 2（停止 + 重新生成）— 最小改动，立即可用
2. Task 5 + 6 + 7（Tool 可视化）— 核心体验提升
3. Task 3 + 4（搜索 + 重命名）— 侧边栏增强
4. Task 8 + 9（MD 确认 + 复制按钮）— 锦上添花
