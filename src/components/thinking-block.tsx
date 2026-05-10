"use client"

import { useState } from "react"
import { Brain, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThinkingBlockProps {
  text: string
  state?: "streaming" | "done"
}

export function ThinkingBlock({ text, state = "done" }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const isStreaming = state === "streaming"

  if (!text && !isStreaming) return null

  return (
    <div className="my-2 rounded-xl border border-purple-200/50 bg-gradient-to-r from-purple-50/50 to-violet-50/30 dark:border-purple-800/30 dark:from-purple-950/20 dark:to-violet-950/10 text-sm transition-all duration-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-purple-100/30 dark:hover:bg-purple-900/20 transition-all duration-200 rounded-xl"
      >
        <Brain
          className={cn(
            "size-4 shrink-0",
            isStreaming ? "text-purple-500 animate-pulse" : "text-purple-400 dark:text-purple-500",
          )}
        />
        <span className="flex-1 text-left text-purple-700 dark:text-purple-300 font-medium">
          {isStreaming ? "正在思考..." : "思考过程"}
        </span>
        {isStreaming && (
          <span className="flex gap-0.5">
            <span className="size-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
        {!isStreaming &&
          (expanded ? (
            <ChevronDown className="size-4 text-purple-400" />
          ) : (
            <ChevronRight className="size-4 text-purple-400" />
          ))}
      </button>

      {(expanded || isStreaming) && text && (
        <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="text-xs text-purple-600/80 dark:text-purple-400/80 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto rounded-lg bg-purple-100/30 dark:bg-purple-900/10 p-2.5 border border-purple-200/30 dark:border-purple-800/20">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
