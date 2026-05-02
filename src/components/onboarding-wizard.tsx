"use client"

import { useState } from "react"
import { Sparkles, MessageSquare, Database, Palette, ArrowRight, Check } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { useModel } from "@/hooks/use-model"
import { useModels } from "@/hooks/use-models"

interface OnboardingWizardProps {
  onComplete: () => void
}

const steps = [
  { id: "welcome", title: "欢迎", icon: Sparkles },
  { id: "theme", title: "外观", icon: Palette },
  { id: "model", title: "模型", icon: MessageSquare },
  { id: "ready", title: "开始", icon: Check },
]

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const { theme, setTheme } = useTheme()
  const { modelId, setModelId } = useModel()
  const { providers, models } = useModels()

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      onComplete()
    }
  }

  const skip = () => onComplete()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 px-6 pt-6">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="p-6">
          {/* Step 0: 欢迎 */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">欢迎使用 xinsight</h2>
              <p className="text-muted-foreground">
                xinsight 是一个多 Agent AI 助手，支持智能对话、深度研究和代码辅助。
                <br />
                让我们花 30 秒完成基础配置。
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { icon: MessageSquare, label: "聊天助手", desc: "通用对话" },
                  { icon: Database, label: "研究助手", desc: "深度分析" },
                  { icon: Sparkles, label: "代码助手", desc: "编程辅助" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3 rounded-xl border border-border bg-muted/30 text-center"
                  >
                    <item.icon className="size-5 mx-auto mb-1.5 text-primary" />
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: 主题选择 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">选择外观主题</h2>
              <p className="text-sm text-muted-foreground">
                选择你喜欢的界面风格，之后可以在设置中更改。
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "light" as const, label: "浅色", emoji: "☀️" },
                  { value: "dark" as const, label: "深色", emoji: "🌙" },
                  { value: "system" as const, label: "跟随系统", emoji: "💻" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      theme === opt.value
                        ? "border-primary bg-primary/10 scale-105"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.emoji}</div>
                    <div className="text-sm font-medium">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: 模型选择 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">选择默认模型</h2>
              <p className="text-sm text-muted-foreground">
                选择 AI 对话使用的模型。不同模型有不同的能力和速度。
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {providers.map((provider) => {
                  const providerModels = models.filter((m) => m.providerId === provider.id)
                  if (providerModels.length === 0) return null
                  return (
                    <div key={provider.id}>
                      <h3 className="text-xs text-muted-foreground mb-1.5 font-medium">
                        {provider.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {providerModels.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setModelId(m.id)}
                            className={`px-3 py-1.5 text-sm rounded-lg border-2 transition-all ${
                              modelId === m.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
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
            </div>
          )}

          {/* Step 3: 完成 */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <Check className="size-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold">一切就绪！</h2>
              <p className="text-muted-foreground">
                配置已保存。你可以直接开始对话，或前往设置页面管理数据源。
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm text-left space-y-2">
                <div>
                  💡 <strong>提示：</strong>试试在输入框中问一个问题
                </div>
                <div>🔄 顶部可以切换不同的 AI 助手</div>
                <div>⚙️ 右上角设置中可以管理数据源</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={skip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            跳过
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {step === steps.length - 1 ? "开始使用" : "下一步"}
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
