'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 알람 음원 선택 화면에서만 쓰는 미리듣기훅입니다.
 * - 한 번에 하나의 소리만 재생하고, 새로 재생하면 이전 것을 끊습니다.
 * - `playingId`로 어느 항목이 재생 중인지 표시할 수 있습니다.
 */
export function useAlarmSoundPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  /** 재생을 멈추고, 재생 중 UI도 초기화합니다. */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayingId(null)
  }, [])

  /**
   * 해당 URL을 미리듣기 재생합니다. `id`는 sounds 목록의 id로, UI에서 재생 중 항목을 가리킬 때 씁니다.
   */
  const play = useCallback(
    (url: string, id: string) => {
      try {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        const a = new Audio(url)
        a.volume = 0.7
        audioRef.current = a
        setPlayingId(id)
        a.addEventListener(
          'ended',
          () => {
            if (audioRef.current === a) {
              setPlayingId(null)
              audioRef.current = null
            }
          },
          { once: true },
        )
        void a.play().catch(() => {
          if (audioRef.current === a) {
            setPlayingId(null)
            audioRef.current = null
          }
        })
      } catch {
        setPlayingId(null)
      }
    },
    [],
  )

  // 컴포넌트가 사라질 때(또는 시트가 닫힐 때 상위에서 stop 호출) 남는 소리를 끄기
  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    },
    [],
  )

  return { play, stop, playingId }
}
