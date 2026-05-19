"use client"

import { useState } from "react"
import type { AdminAgent } from "@/hooks/use-admin-agents"

interface AgentFormProps {
  initialData?: Partial<AdminAgent>
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  isEdit?: boolean
}

export function AgentForm({ initialData, onSubmit, isEdit }: AgentFormProps) {
  const [id, setId] = useState(initialData?.id ?? "")
  const [name, setName] = useState(initialData?.name ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt ?? "")
  const [modelId, setModelId] = useState(initialData?.modelId ?? "")
  const [icon, setIcon] = useState(initialData?.icon ?? "")
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError("")

    if (!isEdit && !id.trim()) {
      setValidationError("ID 不能为空")
      return
    }
    if (!isEdit && !/^[a-z0-9_-]+$/.test(id)) {
      setValidationError("ID 只能包含小写字母、数字、下划线和短横线")
      return
    }
    if (!name.trim()) {
      setValidationError("名称不能为空")
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        ...(isEdit ? {} : { id }),
        name,
        description: description || null,
        systemPrompt,
        modelId: modelId || null,
        icon: icon || null,
        enabled,
      })
    } catch {
      // 错误由父组件处理
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {validationError && <p className="text-destructive text-sm">{validationError}</p>}

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-id">
          ID
        </label>
        <input
          id="agent-id"
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={isEdit}
          placeholder="my-agent"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
        <p className="text-muted-foreground text-xs">
          仅允许小写字母、数字、下划线和短横线 [a-z0-9_-]
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-name">
          名称 <span className="text-destructive">*</span>
        </label>
        <input
          id="agent-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-description">
          描述
        </label>
        <textarea
          id="agent-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-system-prompt">
          系统提示词
        </label>
        <textarea
          id="agent-system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-model">
          模型 ID
        </label>
        <input
          id="agent-model"
          type="text"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="deepseek/deepseek-chat"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-icon">
          图标
        </label>
        <input
          id="agent-icon"
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🤖"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="agent-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border"
        />
        <label className="text-sm font-medium" htmlFor="agent-enabled">
          启用
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "提交中..." : isEdit ? "保存修改" : "创建 Agent"}
      </button>
    </form>
  )
}
