'use client'

import { useEffect, useRef } from 'react'
import { getYouTubeOrigin, loadYouTubeIframeApi, type YouTubePlayerInstance } from '@/lib/youtubeIframeApi'

type Props = {
  videoId: string
  autoplay?: boolean
  title?: string
  className?: string
  onPlayingChange: (playing: boolean) => void
}

/**
 * YouTube IFrame Player — 단일 영상만 재생(플레이리스트·관련 영상 UI 최소화).
 */
export default function ContentYouTubePlayer({
  videoId,
  autoplay = true,
  title = '영상 재생',
  className = '',
  onPlayingChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const onPlayingChangeRef = useRef(onPlayingChange)
  onPlayingChangeRef.current = onPlayingChange

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host || !videoId) return

    void (async () => {
      try {
        const YT = await loadYouTubeIframeApi()
        if (cancelled || !hostRef.current) return

        playerRef.current?.destroy()
        playerRef.current = null

        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: getYouTubeOrigin(),
          },
          events: {
            onStateChange: (event) => {
              const { PLAYING, PAUSED, BUFFERING, ENDED, UNSTARTED, CUED } = YT.PlayerState
              if (event.data === PLAYING || event.data === BUFFERING) {
                onPlayingChangeRef.current(true)
              } else if (
                event.data === PAUSED ||
                event.data === ENDED ||
                event.data === UNSTARTED ||
                event.data === CUED
              ) {
                onPlayingChangeRef.current(false)
              }
            },
          },
        })
      } catch {
        onPlayingChangeRef.current(false)
      }
    })()

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      onPlayingChangeRef.current(false)
    }
  }, [videoId, autoplay])

  return (
    <div className={`relative h-full w-full ${className}`} aria-label={title}>
      <div ref={hostRef} className="h-full w-full" />
    </div>
  )
}
