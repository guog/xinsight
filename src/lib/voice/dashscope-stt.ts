import WebSocket from "ws"
import { randomUUID } from "crypto"

export interface STTSession {
  sendAudio(chunk: ArrayBuffer): void
  finish(): void
  close(): void
  onResult: (text: string, isFinal: boolean) => void
  onError: (error: Error) => void
}

export interface STTOptions {
  model?: string
  languages?: string[]
  sampleRate?: number
}

/**
 * 创建 DashScope Paraformer Realtime STT 会话
 */
export function createSTTSession(apiKey: string, options?: STTOptions): STTSession {
  const model = options?.model ?? "paraformer-realtime-v2"
  const sampleRate = options?.sampleRate ?? 16000
  const languages = options?.languages ?? ["zh", "en"]
  const taskId = randomUUID()

  const ws = new WebSocket("wss://dashscope.aliyuncs.com/api-ws/v1/inference", {
    headers: { Authorization: `bearer ${apiKey}` },
  })

  const session: STTSession = {
    onResult: () => {},
    onError: () => {},

    sendAudio(chunk: ArrayBuffer) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk)
      }
    },

    finish() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            header: { action: "finish-task", task_id: taskId },
          }),
        )
      }
    },

    close() {
      ws.close()
    },
  }

  ws.on("open", () => {
    // 发送启动消息
    ws.send(
      JSON.stringify({
        header: { action: "run-task", task_id: taskId, streaming: "duplex" },
        payload: {
          model,
          task_group: "audio",
          task: "asr",
          function: "recognition",
          parameters: { sample_rate: sampleRate, format: "pcm", language_hints: languages },
        },
      }),
    )
  })

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString())
      const event = msg.header?.event
      if (event === "result-generated") {
        const sentence = msg.payload?.output?.sentence
        if (sentence) {
          // 如果有 end_time 说明是最终结果
          const isFinal = sentence.end_time !== undefined && sentence.end_time !== null
          session.onResult(sentence.text ?? "", isFinal)
        }
      } else if (event === "task-failed") {
        session.onError(new Error(msg.payload?.output?.message ?? "任务失败"))
      }
    } catch (e) {
      session.onError(e instanceof Error ? e : new Error(String(e)))
    }
  })

  ws.on("error", (err: Error) => {
    session.onError(err)
  })

  return session
}
