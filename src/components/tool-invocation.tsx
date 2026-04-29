"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, Database } from "lucide-react"

interface ToolInvocationProps {
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: Record<string, unknown>
  result?: unknown
}

export function ToolInvocation({ toolName, state, args, result }: ToolInvocationProps) {
  const [expanded, setExpanded] = useState(false)

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
        ) : (
          <Loader2 className="size-4 text-blue-500 animate-spin shrink-0" />
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
