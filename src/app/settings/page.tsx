"use client"

import { useTheme } from "@/hooks/use-theme"
import { useModel } from "@/hooks/use-model"
import { getProviders, getModels } from "@/lib/models"
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react"
import Link from "next/link"

const themeOptions = [
  { value: "light" as const, label: "浅色", icon: Sun },
  { value: "dark" as const, label: "深色", icon: Moon },
  { value: "system" as const, label: "跟随系统", icon: Monitor },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { modelId, setModelId } = useModel()
  const providers = getProviders()
  const models = getModels()

  return (
    <main className="flex flex-col h-dvh max-w-2xl mx-auto w-full px-4 py-4">
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">设置</h1>
      </header>

      {/* 主题设置 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">外观</h2>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                theme === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 模型选择 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">默认模型</h2>
        <div className="space-y-2">
          {providers.map((provider) => {
            const providerModels = models.filter((m) => m.providerId === provider.id)
            if (providerModels.length === 0) return null
            return (
              <div key={provider.id}>
                <h3 className="text-xs text-muted-foreground mb-1">{provider.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {providerModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setModelId(m.id)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        modelId === m.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted"
                      }`}
                      title={m.description}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 关于 */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">关于</h2>
        <p className="text-sm text-muted-foreground">xinsight v0.1.0 — 基于多 Agent 的 AI 应用</p>
      </section>
    </main>
  )
}
