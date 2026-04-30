"use client"

import { useEffect, useState } from "react"
import { X, Mic, PhoneOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import { useVoiceChat } from "@/hooks/use-voice-chat"
import { Waveform } from "./waveform"
import { VoiceModeToggle, type VoiceMode } from "./voice-mode-toggle"

interface VoiceChatPanelProps {
  agentId: string
  chatId?: string
  modelId?: string
  onClose: () => void
}

// 状态文字映射
const STATUS_LABELS: Record<string, string> = {
  idle: "准备就绪",
  connecting: "连接中…",
  listening: "正在聆听",
  thinking: "思考中",
  speaking: "回复中",
}

// 语音对话主界面
export function VoiceChatPanel({ agentId, chatId, modelId, onClose }: VoiceChatPanelProps) {
  const [mode, setMode] = useState<VoiceMode>("voice-only")

  const recorder = useAudioRecorder()
  const voice = useVoiceChat({ agentId, chatId, modelId })

  // 挂载时自动连接
  useEffect(() => {
    voice.connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 注册音频回调：录音数据发送到 WS
  useEffect(() => {
    recorder.onAudioChunk((chunk) => {
      voice.sendAudio(chunk)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 录音按钮点击
  const handleMicClick = async () => {
    if (recorder.isRecording) {
      recorder.stop()
      voice.stopListening()
    } else {
      await recorder.start()
      voice.startListening()
    }
  }

  // 结束对话
  const handleEnd = () => {
    recorder.stop()
    voice.end()
    onClose()
  }

  const errorMsg = recorder.error || voice.error

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button
          type="button"
          onClick={handleEnd}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="关闭"
        >
          <X className="w-5 h-5" />
        </button>
        <VoiceModeToggle mode={mode} onModeChange={setMode} />
        <div className="w-9" /> {/* 占位平衡布局 */}
      </div>

      {/* 中间区域 */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-4 overflow-hidden">
        {mode === "voice-only" ? (
          <>
            {/* 全屏波形 */}
            <div className="absolute inset-0">
              <Waveform analyserNode={recorder.analyserNode} mode="fullscreen" />
            </div>
            <p className="relative z-10 text-lg font-medium text-foreground/80">
              {STATUS_LABELS[voice.status] || ""}
            </p>
          </>
        ) : (
          <>
            {/* 紧凑波形背景 */}
            <div className="absolute inset-0">
              <Waveform analyserNode={recorder.analyserNode} mode="compact" />
            </div>
            {/* 文字前景 */}
            <div className="relative z-10 w-full max-w-lg space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {STATUS_LABELS[voice.status] || ""}
              </p>
              {voice.sttText && (
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground mb-1">识别结果</p>
                  <p className="text-sm">{voice.sttText}</p>
                </div>
              )}
              {voice.llmText && (
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground mb-1">AI 回复</p>
                  <p className="text-sm whitespace-pre-wrap">{voice.llmText}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* 错误提示 */}
        {errorMsg && (
          <p className="absolute bottom-4 text-sm text-destructive">{errorMsg}</p>
        )}
      </div>

      {/* 底栏 */}
      <div className="flex items-center justify-center gap-6 px-4 py-6 border-t">
        {/* 录音按钮 */}
        <button
          type="button"
          onClick={handleMicClick}
          disabled={voice.status === "connecting"}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all",
            "border-2",
            recorder.isRecording
              ? "bg-destructive/10 border-destructive text-destructive animate-pulse"
              : "bg-primary/10 border-primary text-primary hover:bg-primary/20"
          )}
          aria-label={recorder.isRecording ? "停止录音" : "开始录音"}
        >
          <Mic className="w-7 h-7" />
        </button>

        {/* 结束对话按钮 */}
        <button
          type="button"
          onClick={handleEnd}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          aria-label="结束对话"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
