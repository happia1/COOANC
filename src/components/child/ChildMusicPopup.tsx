'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 음악 팝업 안에서 재생할 "상황별 키워드 + 영상" 목록입니다.
 * 비개발자: 여기의 `label`/`url`만 바꾸면 버튼 문구와 재생 영상이 함께 바뀝니다.
 */
const TIMER_KEYWORD_VIDEOS = [
  { label: '차분한 아침', url: 'https://youtu.be/u1AVP1pjCgo?si=GM10EwWwpPELrQmE' },
  { label: '빠른 기상', url: 'https://youtu.be/sOX5x-C335o?si=pOjStvOwnhQFU-G8' },
  { label: '식사시간', url: 'https://youtu.be/OxVeowNwyFw?si=uMOJi03Hw7r4qkV1' },
  { label: '놀이시간', url: 'https://youtu.be/yBanUW7ja8M?si=j5COdu4hKoAfHzgl' },
  { label: '모두 제자리', url: 'https://youtu.be/ZChTK8th_ps?si=7DKiV4XGLi6_kWku' },
  { label: '잠잘 준비', url: 'https://youtu.be/bdjyo0qsejI?si=XvMWVjb16aW91Hj4' },
] as const

/**
 * 유튜브 링크를 팝업 내부에서 재생 가능한 embed URL로 변환합니다.
 * - 지원: `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/shorts/<id>`
 */
function toYouTubeEmbedUrl(rawUrl: string, { autoplay = true }: { autoplay?: boolean } = {}): string | null {
  try {
    const u = new URL(rawUrl)
    let videoId: string | null = null

    if (u.hostname === 'youtu.be') {
      videoId = u.pathname.replace(/^\//, '') || null
    } else if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') videoId = u.searchParams.get('v')
      else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2] || null
      else if (u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/')[2] || null
    }
    if (!videoId) return null

    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
      autoplay: autoplay ? '1' : '0',
    })
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
  } catch {
    return null
  }
}

export default function ChildMusicPopup({ open, onClose }: Props) {
  const [portalReady, setPortalReady] = useState(false)
  const [selectedKeywordEmbedUrl, setSelectedKeywordEmbedUrl] = useState<string | null>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setSelectedKeywordEmbedUrl(null)
    }
  }, [open])

  if (!open || !portalReady) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="하루를 돕는 음악"
    >
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative z-[1] mx-auto flex h-auto max-h-[min(85dvh,calc(100vh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-4 py-4">
          <h3 className="text-center text-sm font-black text-gray-800">하루를 돕는 음악</h3>
          <p className="mt-1 text-center text-[12px] font-bold text-gray-500">키워드를 누르면 아래에서 영상이 재생돼요.</p>
          <div className="mt-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/img/common/ui/music.png"
              alt=""
              // 기존 44px의 3/4인 33px로 축소해 음표 아이콘을 더 작게 표시합니다.
              width={33}
              height={33}
              className="h-[33px] w-[33px] object-contain"
              draggable={false}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-1.5">
            {TIMER_KEYWORD_VIDEOS.map((video) => {
              const embedUrl = toYouTubeEmbedUrl(video.url, { autoplay: true })
              return (
                <button
                  key={video.label}
                  type="button"
                  disabled={!embedUrl}
                  onClick={() => setSelectedKeywordEmbedUrl(embedUrl)}
                  className="rounded-xl border border-gray-100 bg-white px-2 py-2 text-center shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${video.label} 영상 재생`}
                >
                  <p className="text-[11px] font-black leading-tight text-gray-900">{video.label}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-black">
            {selectedKeywordEmbedUrl ? (
              <>
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    title="키워드 영상 재생"
                    src={selectedKeywordEmbedUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-center justify-end bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedKeywordEmbedUrl(null)}
                    className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[12px] font-bold text-gray-700"
                    aria-label="영상 닫기"
                  >
                    영상 닫기
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-[160px] items-center justify-center bg-gray-50 px-3 text-center">
                <p className="text-[12px] font-bold text-gray-500">재생할 키워드를 클릭해 주세요.</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700">
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
