"use client"

interface VoiceChatPanelProps {
  onClose: () => void
}

export function VoiceChatPanel({ onClose }: VoiceChatPanelProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
      <div className="text-center space-y-2">
        <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
          <svg
            className="size-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium">语音对话模式</p>
        <p className="text-sm text-muted-foreground">正在监听...</p>
      </div>
      <button
        onClick={onClose}
        className="px-6 py-2 rounded-full bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
      >
        结束语音
      </button>
    </div>
  )
}
