"use client"

import { useRef, useCallback } from "react"

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  edgeWidth?: number
}

/**
 * 手势滑动 hook
 * - edgeWidth: 仅从屏幕边缘开始的触摸才触发（默认 30px）
 * - threshold: 滑动距离阈值（默认 80px）
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  edgeWidth = 30,
}: UseSwipeOptions): SwipeHandlers {
  const startX = useRef(0)
  const startY = useRef(0)
  const isEdgeTouch = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      startX.current = touch.clientX
      startY.current = touch.clientY
      // 只在左边缘或右边缘开始时激活
      const w = window.innerWidth
      isEdgeTouch.current = touch.clientX < edgeWidth || touch.clientX > w - edgeWidth
    },
    [edgeWidth],
  )

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    // 可选：添加视觉反馈
    void e
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isEdgeTouch.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current
      // 确保水平滑动幅度大于垂直
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx > 0) onSwipeRight?.()
        else onSwipeLeft?.()
      }
    },
    [threshold, onSwipeLeft, onSwipeRight],
  )

  return { onTouchStart, onTouchMove, onTouchEnd }
}
