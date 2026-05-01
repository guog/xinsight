"use client"

import { Sparkles, Code, Search, MessageSquare } from "lucide-react"

interface WelcomeEmptyStateProps {
  agentName: string
  onSuggestionClick: (text: string) => void
}

const suggestions = [
  {
    icon: MessageSquare,
    label: "解释概念",
    text: "请用简单的语言解释什么是 RAG（检索增强生成）",
  },
  {
    icon: Search,
    label: "分析数据",
    text: "帮我分析一下常见的数据可视化方案有哪些？各自的优缺点是什么？",
  },
  {
    icon: Code,
    label: "编写代码",
    text: "用 TypeScript 写一个简单的事件总线（EventBus）实现",
  },
  {
    icon: Sparkles,
    label: "头脑风暴",
    text: "我想做一个面向开发者的效率工具，帮我想想有什么方向",
  },
]

export function WelcomeEmptyState({ agentName, onSuggestionClick }: WelcomeEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center space-y-3 mb-8">
        <div className="relative mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm shadow-primary/10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary)/.06),transparent_70%)]" />
          <Sparkles className="size-6 text-primary relative" />
        </div>
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          你好，有什么可以帮你的？
        </h2>
        <p className="text-sm text-muted-foreground">
          当前使用 {agentName}，选择下方建议或直接输入你的问题
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((s, index) => (
          <button
            key={s.label}
            onClick={() => onSuggestionClick(s.text)}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-[1.02] hover:shadow-md transition-all duration-200 text-left group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-muted to-muted/60 group-hover:from-primary/10 group-hover:to-primary/5 transition-colors shrink-0">
              <s.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{s.text}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
