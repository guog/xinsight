"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface WaveformProps {
  analyserNode: AnalyserNode | null
  mode?: "fullscreen" | "compact"
  className?: string
}

// 波形可视化组件，使用 Canvas 绘制实时音频波形
export function Waveform({ analyserNode, mode = "fullscreen", className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 获取 CSS variable 中的 primary 颜色
    const getColor = () => {
      const style = getComputedStyle(canvas)
      const hsl = style.getPropertyValue("--primary").trim()
      return hsl ? `hsl(${hsl})` : "#3b82f6"
    }

    const lineWidth = mode === "fullscreen" ? 3 : 1.5

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()
      // 同步 canvas 分辨率
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = getColor()
      ctx.beginPath()

      if (!analyserNode) {
        // 静止波形：中间一条线
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        animationRef.current = requestAnimationFrame(draw)
        return
      }

      const bufferLength = analyserNode.fftSize
      const dataArray = new Uint8Array(bufferLength)
      analyserNode.getByteTimeDomainData(dataArray)

      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.stroke()
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [analyserNode, mode])

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full", mode === "compact" && "opacity-50", className)}
    />
  )
}
