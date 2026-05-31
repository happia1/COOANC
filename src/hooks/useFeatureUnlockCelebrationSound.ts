'use client'

import { useEffect, useRef } from 'react'
import { AUDIO } from '@/constants/audio'

/**
 * 기능 해금 축하 팝업이 열릴 때 레벨업 축하 효과음을 한 번 재생합니다.
 */
export function useFeatureUnlockCelebrationSound(active: boolean) {
  const playedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      playedRef.current = false
      return
    }
    if (playedRef.current) return
    playedRef.current = true
    try {
      const audio = new Audio(AUDIO.EFFECTS.LEVEL_UP)
      audio.volume = 0.9
      void audio.play().catch(() => {
        /* noop */
      })
    } catch {
      /* noop */
    }
  }, [active])
}
