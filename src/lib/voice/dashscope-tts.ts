// DashScope CosyVoice TTS WebSocket 客户端
import WebSocket from "ws"

const ENDPOINT = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"

export interface TTSSession {
  sendText(text: string): void
  flush(): void
  close(): void
  onAudio: (chunk: ArrayBuffer) => void
  onDone: () => void
  onError: (error: Error) => void
}

export function createTTSSession(
  apiKey: string,
  options?: {
    model?: string
    voice?: string
    sampleRate?: number
    format?: "pcm" | "mp3"
  },
): TTSSession {
  const model = options?.model ?? "cosyvoice-v1"
  const voice = options?.voice ?? "longxiaochun"
  const sampleRate = options?.sampleRate ?? 22050
  const format = options?.format ?? "pcm"
  const taskId = crypto.randomUUID()

  const ws = new WebSocket(ENDPOINT, {
    headers: { Authorization: `bearer ${apiKey}` },
  })

  const session: TTSSession = {
    onAudio: () => {},
    onDone: () => {},
    onError: () => {},

    sendText(text: string) {
      ws.send(
        JSON.stringify({
          header: { action: "continue-task", task_id: taskId },
          payload: { input: { text } },
        }),
      )
    },

    flush() {
      ws.send(
        JSON.stringify({
          header: { action: "finish-task", task_id: taskId },
        }),
      )
    },

    close() {
      ws.close()
    },
  }

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        header: { action: "run-task", task_id: taskId, streaming: "duplex" },
        payload: {
          model,
          task_group: "audio",
          task: "tts",
          function: "SpeechSynthesizer",
          parameters: { voice, format, sample_rate: sampleRate },
          input: { text: "" },
        },
      }),
    )
  }

  ws.onmessage = (event: { data: unknown }) => {
    const { data } = event
    // 二进制数据 → 音频
    if (data instanceof ArrayBuffer || data instanceof Buffer) {
      session.onAudio(data as ArrayBuffer)
      return
    }
    // JSON 事件
    if (typeof data === "string") {
      try {
        const msg = JSON.parse(data)
        if (msg.header?.event === "task-finished") {
          session.onDone()
        }
      } catch {
        // 忽略非 JSON 字符串
      }
    }
  }

  ws.onerror = (err: Error) => {
    session.onError(err)
  }

  return session
}
