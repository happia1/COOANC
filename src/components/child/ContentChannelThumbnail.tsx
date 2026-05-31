'use client'

import { useEffect, useState } from 'react'
import {
  CONTENT_CHANNEL_DEFAULT_THUMBNAIL,
  contentChannelThumbnailUrl,
} from '@/lib/youtubeContent'

type Props = {
  playlistUrl: string
  storedThumbnailUrl?: string | null
  alt?: string
  className?: string
}

/**
 * 콘텐츠 채널 썸네일 — SSR 값 우선, 없으면 API로 유튜브 썸네일 조회
 */
export default function ContentChannelThumbnail({
  playlistUrl,
  storedThumbnailUrl,
  alt = '',
  className = 'aspect-video w-full object-cover',
}: Props) {
  const initial = contentChannelThumbnailUrl(playlistUrl, storedThumbnailUrl)
  const [src, setSrc] = useState(initial)
  const [triedApi, setTriedApi] = useState(false)

  useEffect(() => {
    setSrc(contentChannelThumbnailUrl(playlistUrl, storedThumbnailUrl))
    setTriedApi(false)
  }, [playlistUrl, storedThumbnailUrl])

  useEffect(() => {
    if (triedApi) return
    const syncSrc = contentChannelThumbnailUrl(playlistUrl, storedThumbnailUrl)
    if (syncSrc !== CONTENT_CHANNEL_DEFAULT_THUMBNAIL) {
      setSrc(syncSrc)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/content/thumbnail?url=${encodeURIComponent(playlistUrl)}`)
        const json = (await res.json()) as { thumbnailUrl?: string }
        if (cancelled || !json.thumbnailUrl) return
        setSrc(json.thumbnailUrl)
      } finally {
        if (!cancelled) setTriedApi(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [playlistUrl, storedThumbnailUrl, triedApi])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} draggable={false} loading="lazy" />
  )
}
