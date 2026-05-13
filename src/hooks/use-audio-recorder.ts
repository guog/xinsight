import { useCallback, useRef, useState } from "react"

// 将 Float32Array 转换为 Int16Array (PCM 16bit)
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

// 线性插值下采样
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const a = buffer[idx] ?? 0
    const b = buffer[idx + 1] ?? a
    result[i] = a + frac * (b - a)
  }
  return result
}

const TARGET_SAMPLE_RATE = 16000
const BUFFER_SIZE = 4096

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const callbackRef = useRef<((chunk: ArrayBuffer) => void) | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  const onAudioChunk = useCallback((cb: (chunk: ArrayBuffer) => void) => {
    callbackRef.current = cb
  }, [])

  const start = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      contextRef.current = ctx
      const sourceRate = ctx.sampleRate

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)

      // ScriptProcessorNode 用于获取原始音频数据
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!callbackRef.current) return
        const input = e.inputBuffer.getChannelData(0)
        const downsampled = downsample(input, sourceRate, TARGET_SAMPLE_RATE)
        const pcm = float32ToInt16(downsampled)
        callbackRef.current(pcm.buffer as ArrayBuffer)
      }

      analyser.connect(processor)
      processor.connect(ctx.destination)

      setAnalyserNode(analyser)
      setIsRecording(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "麦克风访问失败"
      setError(msg)
    }
  }, [])

  const stop = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    if (contextRef.current) {
      contextRef.current.close()
      contextRef.current = null
    }

    setAnalyserNode(null)
    setIsRecording(false)
  }, [])

  return {
    isRecording,
    start,
    stop,
    onAudioChunk,
    analyserNode,
    error,
  }
}
