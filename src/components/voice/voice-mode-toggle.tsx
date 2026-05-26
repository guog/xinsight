"use client"

import { cn } from "@/lib/utils"

export type VoiceMode = "voice-only" | "voice-text"

interface VoiceModeToggleProps {
  mode: VoiceMode
  onModeChange: (mode: VoiceMode) => void
  className?: string
}

// 纯语音 / 语音+文字 子模式切换
export function VoiceModeToggle({ mode, onModeChange, className }: VoiceModeToggleProps) {
  return (
    <div className={cn("flex rounded-lg bg-muted p-1 gap-1", className)}>
      <button
        type="button"
        onClick={() => onModeChange("voice-only")}
        className={cn(
          "px-3 py-1 text-sm rounded-md transition-colors",
          mode === "voice-only"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        纯语音
      </button>
      <button
        type="button"
        onClick={() => onModeChange("voice-text")}
        className={cn(
          "px-3 py-1 text-sm rounded-md transition-colors",
          mode === "voice-text"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        语音+文字
      </button>
    </div>
  )
}
