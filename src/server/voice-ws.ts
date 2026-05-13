// 语音对话 WebSocket 服务器
// 桥接前端 ↔ STT ↔ LLM ↔ TTS
import { WebSocketServer, WebSocket } from "ws"
import { createSTTSession, type STTSession } from "@/lib/voice/dashscope-stt"
import { createTTSSession, type TTSSession } from "@/lib/voice/dashscope-tts"
import { getVoiceConfig } from "@/lib/voice"
import { mastra } from "@/mastra"
import { toAISdkStream } from "@mastra/ai-sdk"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { getProviderForModel, getModelById, getDefaultModelId } from "@/lib/models"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq } from "drizzle-orm"

// 客户端 → 服务端消息类型
type ClientMessage =
  | { type: "audio"; data: string }
  | { type: "start"; agentId: string; chatId?: string; modelId?: string; voice?: string }
  | { type: "stop" }
  | { type: "end" }

// 服务端 → 客户端消息类型
type ServerMessage =
  | { type: "stt_partial"; text: string }
  | { type: "stt_final"; text: string }
  | { type: "llm_delta"; text: string }
  | { type: "llm_done"; fullText: string }
  | { type: "tts_audio"; data: string }
  | { type: "tts_done" }
  | { type: "error"; message: string }

// 每个连接的会话状态
interface SessionState {
  agentId: string
  modelId?: string
  chatId?: string
  voice?: string
  sttSession: STTSession | null
  ttsSession: TTSSession | null
  accumulatedText: string
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

/** 按句子分割文本，返回 [完整句子们, 剩余部分] */
function splitSentences(text: string): [string[], string] {
  const sentenceEnders = /([。！？.!?\n])/
  const parts = text.split(sentenceEnders)
  const sentences: string[] = []
  let i = 0
  while (i < parts.length - 1) {
    if (sentenceEnders.test(parts[i + 1] ?? "")) {
      sentences.push(parts[i]! + parts[i + 1]!)
      i += 2
    } else {
      sentences.push(parts[i]!)
      i += 1
    }
  }
  const remainder = i < parts.length ? parts[i]! : ""
  return [sentences.filter((s) => s.trim().length > 0), remainder]
}

/** 处理 LLM 流式输出并推送给客户端 + TTS */
async function processLLM(ws: WebSocket, state: SessionState, text: string) {
  const voiceConfig = getVoiceConfig()

  // 构建模型实例
  const effectiveModelId = state.modelId || getDefaultModelId()
  const provider = getProviderForModel(effectiveModelId)
  const modelInfo = getModelById(effectiveModelId)
  let modelInstance = undefined
  if (provider && modelInfo) {
    const client = createOpenAICompatible({
      name: provider.id,
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    })
    modelInstance = client.chatModel(modelInfo.modelSlug)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agent = mastra.getAgent(state.agentId as any) as any

  // 启动 TTS 会话
  let ttsSession: TTSSession | null = null
  if (voiceConfig.enabled && voiceConfig.ttsProvider) {
    const ttsConfig = voiceConfig.ttsProvider
    ttsSession = createTTSSession(ttsConfig.apiKey, {
      model: ttsConfig.model,
      voice: state.voice || ttsConfig.voice,
      sampleRate: ttsConfig.sampleRate,
    })
    ttsSession.onAudio = (chunk) => {
      const base64 = Buffer.from(chunk).toString("base64")
      send(ws, { type: "tts_audio", data: base64 })
    }
    ttsSession.onDone = () => {
      send(ws, { type: "tts_done" })
    }
    ttsSession.onError = (err) => {
      send(ws, { type: "error", message: `TTS 错误: ${err.message}` })
    }
    state.ttsSession = ttsSession
  }

  try {
    const stream = await agent.stream([{ role: "user", content: text }], {
      ...(modelInstance ? { model: modelInstance } : {}),
    })
    const reader = toAISdkStream(stream, { from: "agent", version: "v6" }).getReader()

    let fullText = ""
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // value 可能是 Uint8Array，需要解码
      const chunk =
        typeof value === "string" ? value : new TextDecoder().decode(value as unknown as Uint8Array)
      // 解析 SSE 格式的数据
      const lines = chunk.split("\n")
      for (const line of lines) {
        if (!line.startsWith("0:")) continue
        try {
          const jsonStr = line.slice(2)
          const delta = JSON.parse(jsonStr) as string
          if (delta) {
            fullText += delta
            buffer += delta
            send(ws, { type: "llm_delta", text: delta })

            // 按句子发送到 TTS
            if (ttsSession) {
              const [sentences, remainder] = splitSentences(buffer)
              for (const sentence of sentences) {
                ttsSession.sendText(sentence)
              }
              buffer = remainder
            }
          }
        } catch {
          // 非文本 chunk，跳过
        }
      }
    }

    // 发送剩余 buffer 到 TTS
    if (ttsSession && buffer.trim()) {
      ttsSession.sendText(buffer)
    }
    if (ttsSession) {
      ttsSession.flush()
    }

    send(ws, { type: "llm_done", fullText })

    // 持久化语音对话到数据库
    if (state.chatId && fullText) {
      try {
        // 保存用户消息（标记为语音来源）
        await db
          .insert(messages)
          .values({
            id: crypto.randomUUID(),
            chatId: state.chatId,
            role: "user",
            parts: JSON.stringify([{ type: "text", text }, { type: "audio" }]),
            createdAt: new Date(),
          })
          .onConflictDoNothing()

        // 保存 assistant 消息
        await db.insert(messages).values({
          id: crypto.randomUUID(),
          chatId: state.chatId,
          role: "assistant",
          parts: JSON.stringify([{ type: "text", text: fullText }]),
          createdAt: new Date(),
        })

        // 更新对话时间
        await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, state.chatId))
      } catch (dbErr) {
        console.error("语音消息持久化失败:", dbErr)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    send(ws, { type: "error", message: `LLM 错误: ${message}` })
  }
}

function handleConnection(ws: WebSocket) {
  const state: SessionState = {
    agentId: "chatAgent",
    sttSession: null,
    ttsSession: null,
    accumulatedText: "",
  }

  ws.on("message", (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString())

      switch (msg.type) {
        case "start": {
          state.agentId = msg.agentId || "chatAgent"
          state.modelId = msg.modelId
          state.chatId = msg.chatId
          state.voice = msg.voice
          state.accumulatedText = ""

          // 初始化 STT
          const voiceConfig = getVoiceConfig()
          if (!voiceConfig.enabled || !voiceConfig.sttProvider) {
            send(ws, {
              type: "error",
              message: "语音功能未启用，请配置 DASHSCOPE_API_KEY 和 VOICE_ENABLED=true",
            })
            return
          }

          const sttConfig = voiceConfig.sttProvider
          const stt = createSTTSession(sttConfig.apiKey, {
            model: sttConfig.model,
            languages: sttConfig.languages,
          })

          stt.onResult = (text, isFinal) => {
            if (isFinal) {
              state.accumulatedText += text
              send(ws, { type: "stt_final", text })
            } else {
              send(ws, { type: "stt_partial", text })
            }
          }

          stt.onError = (err) => {
            send(ws, { type: "error", message: `STT 错误: ${err.message}` })
          }

          state.sttSession = stt
          break
        }

        case "audio": {
          if (!state.sttSession) {
            send(ws, { type: "error", message: "会话未开始，请先发送 start" })
            return
          }
          // base64 PCM → ArrayBuffer
          const buffer = Buffer.from(msg.data, "base64")
          state.sttSession.sendAudio(
            buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          )
          break
        }

        case "stop": {
          // 用户停止录音，结束 STT 并触发 LLM
          if (state.sttSession) {
            state.sttSession.finish()
            // 等待最终结果后触发 LLM（通过短延迟等 STT final 回调）
            setTimeout(() => {
              if (state.accumulatedText.trim()) {
                processLLM(ws, state, state.accumulatedText.trim())
              } else {
                send(ws, { type: "error", message: "未识别到有效语音内容" })
              }
            }, 1000)
          }
          break
        }

        case "end": {
          // 客户端主动关闭
          cleanup(state)
          ws.close()
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send(ws, { type: "error", message: `消息解析错误: ${message}` })
    }
  })

  ws.on("close", () => {
    cleanup(state)
  })

  ws.on("error", () => {
    cleanup(state)
  })
}

function cleanup(state: SessionState) {
  if (state.sttSession) {
    state.sttSession.close()
    state.sttSession = null
  }
  if (state.ttsSession) {
    state.ttsSession.close()
    state.ttsSession = null
  }
}

let wss: WebSocketServer | null = null

/** 启动语音 WebSocket 服务器 */
export function startVoiceWebSocketServer(): WebSocketServer {
  if (wss) return wss

  const port = parseInt(process.env.VOICE_WS_PORT || "3001", 10)
  wss = new WebSocketServer({ port })

  wss.on("connection", handleConnection)
  wss.on("listening", () => {
    console.log(`🎙️ 语音 WebSocket 服务器已启动，端口: ${port}`)
  })

  return wss
}

/** 停止服务器 */
export function stopVoiceWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (wss) {
      wss.close(() => {
        wss = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}
