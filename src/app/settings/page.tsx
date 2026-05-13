"use client"
import { useState, useEffect } from "react"
import { useTheme } from "@/hooks/use-theme"
import { useModel } from "@/hooks/use-model"
import { useUser } from "@/hooks/use-user"
import { ArrowLeft, Sun, Moon, Monitor, Database } from "lucide-react"
import Link from "next/link"
import { useIsMobile } from "@/hooks/use-device"
import { MobileSettingsPage } from "@/components/mobile-settings-page"

const themeOptions = [
  { value: "light" as const, label: "浅色", icon: Sun },
  { value: "dark" as const, label: "深色", icon: Moon },
  { value: "system" as const, label: "跟随系统", icon: Monitor },
]

export default function SettingsPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileSettingsPage />
  return <DesktopSettingsPage />
}

function DesktopSettingsPage() {
  const { theme, setTheme, density, setDensity } = useTheme()
  const { modelId, setModelId } = useModel()
  const { isAdmin } = useUser()
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [models, setModels] = useState<
    { id: string; name: string; description?: string; providerId: string }[]
  >([])

  // 从 API 获取模型列表
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers || [])
        setModels(data.models || [])
      })
      .catch(() => {})
  }, [])

  return (
    <main className="flex flex-col h-dvh max-w-2xl mx-auto w-full px-4 py-4 pb-20 md:pb-4 animate-in fade-in duration-300">
      <header className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
        <Link href="/" className="p-2 rounded-lg hover:bg-muted/80 transition-all duration-200">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">设置</h1>
      </header>

      {/* 外观设置 */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          外观
        </h2>
        <div className="bg-card rounded-xl border border-border p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">主题</h3>
            <div className="flex gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                    theme === value
                      ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10 font-medium"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">显示密度</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setDensity("comfortable")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                  density === "comfortable"
                    ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10 font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                舒适
              </button>
              <button
                onClick={() => setDensity("compact")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                  density === "compact"
                    ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10 font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                紧凑
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 模型选择 — 仅管理员可见 */}
      {isAdmin && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            默认模型
          </h2>
          <div className="bg-card rounded-xl border border-border p-4">
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
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 ${
                            modelId === m.id
                              ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10 font-medium"
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
            <p className="text-xs text-muted-foreground mt-3">
              ℹ️ 模型提供商通过环境变量配置。如需添加或变更，请修改部署配置中的
              LLM_PROVIDERS、*_API_KEY、*_MODELS 等环境变量，详见 .env.example。
            </p>
          </div>
        </section>
      )}
      {/* 数据源管理 — 仅管理员可见 */}
      {isAdmin && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            管理
          </h2>
          <div className="bg-card rounded-xl border border-border p-4">
            <Link
              href="/admin/datasources"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted/80 transition-all duration-200 text-sm w-fit"
            >
              <Database className="size-4" />
              数据源管理
            </Link>
          </div>
        </section>
      )}

      {/* 关于 */}
      <section>
        <h2 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          关于
        </h2>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">xinsight v0.1.0 — 基于多 Agent 的 AI 应用</p>
        </div>
      </section>
    </main>
  )
}
