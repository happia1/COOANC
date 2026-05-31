'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Options = {
  totalSeconds: number
  isPlaying: boolean
  enabled: boolean
  /** 세션 복구 시 남은 초(없으면 처음부터) */
  initialRemainingSec?: number | null
  onExpire: () => void
}

/**
 * 재생 중일 때만 줄어드는 시청 타이머 (일시정지 시 멈춤)
 * 비개발자: 영상을 멈추면 위쪽 시간도 같이 멈춥니다.
 */
export function useContentPlaybackTimer({
  totalSeconds,
  isPlaying,
  enabled,
  initialRemainingSec = null,
  onExpire,
}: Options) {
  const [remainingSec, setRemainingSec] = useState(
    initialRemainingSec ?? totalSeconds,
  )
  const playedMsRef = useRef(0)
  const segmentStartRef = useRef<number | null>(null)
  const endedRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const reset = useCallback(
    (nextTotalSec = totalSeconds) => {
      playedMsRef.current = 0
      segmentStartRef.current = null
      endedRef.current = false
      setRemainingSec(nextTotalSec)
    },
    [totalSeconds],
  )

  useEffect(() => {
    if (!enabled) return
    endedRef.current = false
    segmentStartRef.current = null
    if (initialRemainingSec != null) {
      playedMsRef.current = Math.max(0, (totalSeconds - initialRemainingSec) * 1000)
      setRemainingSec(Math.max(0, initialRemainingSec))
    } else {
      playedMsRef.current = 0
      setRemainingSec(totalSeconds)
    }
  }, [enabled, totalSeconds, initialRemainingSec])

  useEffect(() => {
    if (!enabled) return
    if (isPlaying) {
      if (segmentStartRef.current == null) {
        segmentStartRef.current = Date.now()
      }
      return
    }
    if (segmentStartRef.current != null) {
      playedMsRef.current += Date.now() - segmentStartRef.current
      segmentStartRef.current = null
    }
  }, [enabled, isPlaying])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      let playedMs = playedMsRef.current
      if (segmentStartRef.current != null) {
        playedMs += Date.now() - segmentStartRef.current
      }
      const rem = Math.max(0, totalSeconds - Math.floor(playedMs / 1000))
      setRemainingSec(rem)
      if (rem <= 0 && !endedRef.current) {
        endedRef.current = true
        onExpireRef.current()
      }
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [enabled, totalSeconds])

  return { remainingSec, reset }
}
