"use client"

import { useRouter } from "next/navigation"
import { Moon, Sun, Monitor, User } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { useUser } from "@/hooks/use-user"

import { cn } from "@/lib/utils"

export function MobileSettingsPage() {
  const { theme, setTheme, density, setDensity } = useTheme()
  const { user } = useUser()
  const router = useRouter()

  return (
    <div className="flex flex-col h-dvh safe-top">
      <header className="flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg active:bg-muted">
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-lg font-semibold ml-2">设置</h1>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
        {/* 用户信息 */}
        {user && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{user.displayName || user.username}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
        )}

        {/* 外观 */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground">外观</h2>
          </div>
          <div className="grid grid-cols-3 gap-0">
            {[
              { key: "light" as const, icon: Sun, label: "浅色" },
              { key: "dark" as const, icon: Moon, label: "深色" },
              { key: "system" as const, icon: Monitor, label: "系统" },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={`flex flex-col items-center gap-1.5 py-4 transition-colors ${
                  theme === key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground active:bg-muted"
                }`}
              >
                <Icon className="size-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">紧凑模式</h2>
              <p className="text-xs text-muted-foreground">缩小气泡间距和字号，提升信息密度</p>
            </div>
            <button
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                density === "compact" ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 transform rounded-full bg-white transition-transform shadow-sm",
                  density === "compact" ? "translate-x-5" : "translate-x-1",
                )}
              />
            </button>
          </div>
        </div>

        {/* 关于 */}
        <div className="rounded-xl bg-card border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">xinsight v0.1.0 — 基于多 Agent 的 AI 应用</p>
        </div>
      </div>
    </div>
  )
}
