import { useCallback, useEffect, useRef, useState } from "react"

type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking"

interface VoiceChatOptions {
  agentId: string
  chatId?: string
  modelId?: string
}

const WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL || "ws://localhost:3001"
const MAX_RECONNECT = 3

// ArrayBuffer 转 base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function useVoiceChat(options: VoiceChatOptions) {
  const { agentId, chatId, modelId } = options

  const [status, setStatus] = useState<VoiceStatus>("idle")
  const [sttText, setSttText] = useState("")
  const [llmText, setLlmText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCount = useRef(0)
  const shouldReconnect = useRef(false)
  const connectRef = useRef<() => void>(() => {})

  // 处理服务端消息
  const handleMessage = useCallback((ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data)
      switch (msg.type) {
        case "stt_partial":
          setSttText(msg.text)
          break
        case "stt_final":
          setSttText(msg.text)
          setStatus("thinking")
          break
        case "llm_delta":
          setLlmText((prev) => prev + msg.text)
          break
        case "llm_done":
          setLlmText(msg.fullText)
          break
        case "tts_audio":
          setStatus("speaking")
          break
        case "tts_done":
          setStatus("listening")
          break
        case "error":
          setError(msg.message)
          break
      }
    } catch {
      // 忽略非 JSON 消息
    }
  }, [])

  // 建立连接
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus("connecting")
    setError(null)
    shouldReconnect.current = true

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setIsConnected(true)
      reconnectCount.current = 0
      setStatus("idle")
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null
      // 自动重连
      if (shouldReconnect.current && reconnectCount.current < MAX_RECONNECT) {
        reconnectCount.current++
        setTimeout(() => connectRef.current(), 1000 * reconnectCount.current)
      } else {
        setStatus("idle")
      }
    }

    ws.onerror = () => {
      setError("WebSocket 连接错误")
    }

    wsRef.current = ws
  }, [handleMessage])
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // 发送 start 开始监听
  const startListening = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setSttText("")
    setLlmText("")
    setError(null)
    wsRef.current.send(JSON.stringify({ type: "start", agentId, chatId, modelId }))
    setStatus("listening")
  }, [agentId, chatId, modelId])

  // 发送音频帧
  const sendAudio = useCallback((chunk: ArrayBuffer) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: "audio", data: arrayBufferToBase64(chunk) }))
  }, [])

  // 停止监听
  const stopListening = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: "stop" }))
  }, [])

  // 结束并关闭连接
  const end = useCallback(() => {
    shouldReconnect.current = false
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "end" }))
      }
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus("idle")
    setIsConnected(false)
  }, [])

  // 组件卸载时关闭连接（发送 end 信令通知服务端清理资源）
  useEffect(() => {
    return () => {
      shouldReconnect.current = false
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "end" }))
        }
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return {
    status,
    sttText,
    llmText,
    isConnected,
    connect,
    startListening,
    sendAudio,
    stopListening,
    end,
    error,
  }
}
