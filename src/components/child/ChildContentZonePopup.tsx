'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CHILD_CONTENT_MENU_ITEMS,
  childContentMenuLockLabel,
  isChildContentMenuAvailable,
  type ChildContentMenuItemId,
} from '@/constants/childContentMenu'
import ContentChannelThumbnail from '@/components/child/ContentChannelThumbnail'
import {
  ContentTicketCountChip,
  ContentVideoWatchBalanceRow,
} from '@/components/child/ContentTicketBalanceDisplay'
import ContentWatchTimer from '@/components/child/ContentWatchTimer'
import ContentYouTubePlayer from '@/components/child/ContentYouTubePlayer'
import type { ContentChannel, ContentSession } from '@/types/database'
import { useContentPlaybackTimer } from '@/hooks/useContentPlaybackTimer'
import {
  formatWatchTimeClock,
  totalVideoWatchSecondsFromBalances,
} from '@/lib/contentWatchTime'
import {
  remainingContentSeconds,
  youtubeVideoThumbnailUrl,
  type YouTubeListVideo,
} from '@/lib/youtubeContent'

type Props = {
  open: boolean
  onClose: () => void
  childId: string
  channels: ContentChannel[]
  /** 자녀 현재 레벨 — 미니게임 메뉴 레벨 게이트(10)에 사용 */
  level: number
  /** 영상 시청·인형뽑기 미니게임 공용 「보물상자 티켓」 수량 */
  initialChestTicketQuantity: number
  initialActiveSession: ContentSession | null
  /** 「미션 하러 가기」 — 미션 카드 영역으로 스크롤 */
  onGoToMissions: () => void
  onChestTicketQuantityChange: (quantity: number) => void
  /** 인형뽑기 그랩 API 요청 중임을 ChildScreen의 pendingStatsWritesRef 카운터에 알림 */
  onClawGrabPending: (pending: boolean) => void
  /** 인형뽑기로 받은 하트·크레딧을 ChildScreen의 stats에 반영 */
  onClawStatsSynced: (patch: Record<string, unknown>) => void
}

/** menu · browse · pickVideo(영상 선택) · watching · timeup */
type Phase = 'menu' | 'browse' | 'pickVideo' | 'watching' | 'timeup'

function readSessionRemainingSeconds(session: ContentSession): number {
  if (
    session.remaining_play_seconds != null &&
    Number.isFinite(session.remaining_play_seconds) &&
    session.remaining_play_seconds > 0
  ) {
    return session.remaining_play_seconds
  }
  return remainingContentSeconds(session.started_at, session.duration_minutes)
}

/**
 * 보물상자(콘텐츠) 팝업
 * - 1단계: 영상·미니게임 등 메뉴 선택
 * - 영상: 이용권 확인 → iframe 30분 시청
 * - 미니게임: 추후 구현 (현재 준비 중 안내)
 */
export default function ChildContentZonePopup({
  open,
  onClose,
  childId,
  channels,
  level,
  initialChestTicketQuantity,
  initialActiveSession,
  onGoToMissions,
  onChestTicketQuantityChange,
  onClawGrabPending,
  onClawStatsSynced,
}: Props) {
  const [portalReady, setPortalReady] = useState(false)
  const [chestTicketQty, setChestTicketQty] = useState(initialChestTicketQuantity)
  const [phase, setPhase] = useState<Phase>('menu')
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<ContentChannel | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [remainingPlaySeconds, setRemainingPlaySeconds] = useState(0)
  const [watchSecondsPool, setWatchSecondsPool] = useState(0)
  const [playlistVideos, setPlaylistVideos] = useState<YouTubeListVideo[]>([])
  const [videosLoading, setVideosLoading] = useState(false)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [timerInitialRemaining, setTimerInitialRemaining] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const endedRef = useRef(false)
  /** 팝업이 이미 열린 상태인지 — 이용권 갱신 시 메뉴로 롤백하지 않기 위함 */
  const popupOpenedRef = useRef(false)

  const totalAvailableSeconds = watchSecondsPool + (sessionId ? remainingPlaySeconds : 0)
  const displayWatchSeconds = totalVideoWatchSecondsFromBalances(
    chestTicketQty,
    watchSecondsPool,
    sessionId ? remainingPlaySeconds : 0,
  )

  const saveSessionProgress = useCallback(
    async (secondsLeft: number) => {
      if (!sessionId || secondsLeft <= 0) return
      const rem = Math.max(0, Math.floor(secondsLeft))
      setRemainingPlaySeconds(rem)
      setTimerInitialRemaining(rem)
      await fetch('/api/content/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, childId, remainingPlaySeconds: rem }),
      }).catch(() => {})
    },
    [sessionId, childId],
  )

  const endSessionOnServer = useCallback(async () => {
    if (!sessionId) return
    await fetch('/api/content/end-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, childId }),
    }).catch(() => {})
    setSessionId(null)
  }, [sessionId, childId])

  /** 타이머가 0이 됐을 때만 — 「약속한 시간이 다 됐어!」 화면 */
  const finishSessionOnTimeUp = useCallback(async () => {
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    setPhase('timeup')
    await endSessionOnServer()
  }, [endSessionOnServer])

  const timerEnabled = phase === 'pickVideo' || phase === 'watching'
  const { remainingSec } = useContentPlaybackTimer({
    totalSeconds: Math.max(1, remainingPlaySeconds),
    isPlaying: isVideoPlaying,
    enabled: timerEnabled,
    initialRemainingSec: timerInitialRemaining,
    onExpire: () => {
      if (!endedRef.current) {
        endedRef.current = true
        void finishSessionOnTimeUp()
      }
    },
  })

  const remainingSecRef = useRef(remainingSec)
  remainingSecRef.current = remainingSec

  /** 영상 리스트에서 뒤로 — 남은 시간 저장 후 채널 목록으로 */
  const handleBackToBrowse = useCallback(() => {
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    void saveSessionProgress(remainingSecRef.current)
    setPhase('browse')
  }, [saveSessionProgress])

  const loadPlaylistVideos = useCallback(async (sourceUrl: string): Promise<YouTubeListVideo[]> => {
    setVideosLoading(true)
    try {
      const res = await fetch(
        `/api/content/playlist-videos?url=${encodeURIComponent(sourceUrl)}`,
        { credentials: 'same-origin' },
      )
      const json = (await res.json().catch(() => ({}))) as { videos?: YouTubeListVideo[] }
      const videos = Array.isArray(json.videos) ? json.videos : []
      setPlaylistVideos(videos)
      return videos
    } catch {
      setPlaylistVideos([])
      return []
    } finally {
      setVideosLoading(false)
    }
  }, [])

  const syncChestTicketQty = useCallback(
    (quantity: number) => {
      setChestTicketQty(quantity)
      onChestTicketQuantityChange(quantity)
    },
    [onChestTicketQuantityChange],
  )

  const resetToMenu = useCallback(() => {
    setPhase('menu')
    setComingSoonLabel(null)
    setSelectedChannel(null)
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    setPlaylistVideos([])
    setTimerInitialRemaining(null)
  }, [])

  /** 팝업이 처음 열릴 때만 화면·세션 초기화 (이용권 props 변경 시 browse 롤백 방지) */
  useEffect(() => {
    if (!open) {
      popupOpenedRef.current = false
      return
    }

    const isFirstOpen = !popupOpenedRef.current
    popupOpenedRef.current = true
    if (!isFirstOpen) return

    setChestTicketQty(initialChestTicketQuantity)
    endedRef.current = false
    setComingSoonLabel(null)
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    setPlaylistVideos([])
    setPhase('menu')

    if (initialActiveSession) {
      const rem = readSessionRemainingSeconds(initialActiveSession)
      if (rem > 0 && initialActiveSession.playlist_url) {
        setSelectedChannel(
          channels.find((c) => c.playlist_url === initialActiveSession.playlist_url) ?? null,
        )
        setSessionId(initialActiveSession.id)
        setRemainingPlaySeconds(rem)
        setTimerInitialRemaining(rem)
      } else {
        setSelectedChannel(null)
        setSessionId(null)
        setRemainingPlaySeconds(0)
        setTimerInitialRemaining(null)
        if (rem <= 0) {
          void fetch('/api/content/end-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: initialActiveSession.id, childId }),
          })
        }
      }
    } else {
      resetToMenu()
      setSessionId(null)
    }
  }, [
    open,
    initialChestTicketQuantity,
    initialActiveSession,
    childId,
    channels,
    resetToMenu,
  ])

  /** 팝업이 열려 있는 동안 이용권·시청 시간 갱신 (phase 는 유지) */
  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const res = await fetch(
          `/api/content/ticket-balances?childId=${encodeURIComponent(childId)}`,
          { credentials: 'same-origin' },
        )
        if (!res.ok) return
        const json = (await res.json()) as {
          chestTicketQuantity?: number
          watchSecondsPool?: number
          totalWatchSeconds?: number
          activeSession?: {
            id?: string
            remainingPlaySeconds?: number
            playlistUrl?: string | null
          } | null
        }
        syncChestTicketQty(
          typeof json.chestTicketQuantity === 'number'
            ? json.chestTicketQuantity
            : initialChestTicketQuantity,
        )
        if (typeof json.watchSecondsPool === 'number') {
          setWatchSecondsPool(json.watchSecondsPool)
        }
        const active = json.activeSession
        if (active?.id && typeof active.remainingPlaySeconds === 'number' && active.remainingPlaySeconds > 0) {
          setSessionId(active.id)
          setRemainingPlaySeconds(active.remainingPlaySeconds)
          if (phase === 'menu' || phase === 'browse') {
            setTimerInitialRemaining(active.remainingPlaySeconds)
          }
        }
      } catch {
        /* 실패 시 props 기준 값 유지 */
      }
    })()
  }, [
    open,
    childId,
    initialChestTicketQuantity,
    syncChestTicketQty,
    phase,
  ])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  function handleMenuSelect(id: ChildContentMenuItemId) {
    const item = CHILD_CONTENT_MENU_ITEMS.find((m) => m.id === id)
    if (!item) return

    if (!isChildContentMenuAvailable(id, level)) {
      setComingSoonLabel(childContentMenuLockLabel(id) ?? `${item.title}은(는) 곧 추가될 예정이에요!`)
      return
    }

    if (id === 'video') {
      setComingSoonLabel(null)
      setPhase('browse')
    } else if (id === 'minigame') {
      setComingSoonLabel(`${item.title}은(는) 곧 추가될 예정이에요!`)
    }
  }

  function handleChannelClick(channel: ContentChannel) {
    setSelectedChannel(channel)
    if (busy) return
    void enterChannel(channel)
  }

  async function enterChannel(channel: ContentChannel) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/content/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, playlistUrl: channel.playlist_url }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        sessionId?: string
        remainingPlaySeconds?: number
        remainingQuantity?: number
        watchSecondsPool?: number
        resumed?: boolean
      }
      if (!res.ok) {
        window.alert(json.error ?? '시청을 시작할 수 없어요')
        setPhase('browse')
        return
      }
      if (typeof json.remainingQuantity === 'number') {
        syncChestTicketQty(json.remainingQuantity)
      }
      if (typeof json.watchSecondsPool === 'number') {
        setWatchSecondsPool(json.watchSecondsPool)
      }
      setSessionId(json.sessionId ?? null)
      const rem =
        typeof json.remainingPlaySeconds === 'number' && json.remainingPlaySeconds > 0
          ? json.remainingPlaySeconds
          : remainingPlaySeconds
      setRemainingPlaySeconds(rem)
      setTimerInitialRemaining(rem)
      setActiveVideoId(null)
      setIsVideoPlaying(false)
      endedRef.current = false
      setPhase('pickVideo')
      void loadPlaylistVideos(channel.playlist_url)
    } finally {
      setBusy(false)
    }
  }

  function handlePickVideo(video: YouTubeListVideo) {
    setActiveVideoId(video.videoId)
    setIsVideoPlaying(false)
    setPhase('watching')
  }

  function handleBackToVideoList() {
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    void saveSessionProgress(remainingSecRef.current)
    setPhase('pickVideo')
  }

  const watchBackButtonClass =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/75 text-xl font-bold leading-none text-white ring-1 ring-white/25 backdrop-blur-sm transition active:scale-95'

  function handleCloseFromBrowse() {
    if (sessionId && remainingSecRef.current > 0) {
      void saveSessionProgress(remainingSecRef.current).finally(() => onClose())
      return
    }
    onClose()
  }

  function handleCloseOverlay() {
    if (phase === 'watching' || phase === 'pickVideo') return
    if (phase === 'browse' && sessionId && remainingSecRef.current > 0) {
      void saveSessionProgress(remainingSecRef.current).finally(() => onClose())
      return
    }
    onClose()
  }

  const showModal = phase === 'menu' || phase === 'browse'

  if (!open || !portalReady) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[165] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="보물상자 콘텐츠"
    >
      {phase !== 'watching' && phase !== 'pickVideo' && phase !== 'timeup' ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/45"
          aria-label="닫기"
          onClick={handleCloseOverlay}
        />
      ) : (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}

      {showModal ? (
        <div
          className={`relative z-[1] mx-auto flex h-auto w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${
            phase === 'browse'
              ? 'max-h-[min(90dvh,calc(100vh-1.5rem))] max-w-md'
              : 'max-h-[min(85dvh,calc(100vh-2rem))] max-w-xs'
          }`}
        >
          {/* ── 헤더 ── */}
          <div className="border-b border-gray-100 px-4 py-4">
            {phase === 'menu' ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/img/items/stickers/treasure.png"
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain"
                    draggable={false}
                  />
                  <h3 className="text-base font-black text-gray-800">보물상자</h3>
                </div>
                <p className="mt-2 text-center text-[11px] font-bold leading-snug text-gray-400">
                  마켓에서 이용권 구매 후 컨텐츠를 이용해보세요!
                </p>
              </>
            ) : phase === 'browse' ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetToMenu}
                    className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-600"
                    aria-label="메뉴로 돌아가기"
                  >
                    ← 메뉴
                  </button>
                  <h3 className="flex-1 text-center text-base font-black text-gray-800">영상 보기</h3>
                  <button
                    type="button"
                    onClick={handleCloseFromBrowse}
                    className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-600"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex justify-center">
                  <ContentVideoWatchBalanceRow
                    ticketQuantity={chestTicketQty}
                    watchTimeLabel={formatWatchTimeClock(displayWatchSeconds)}
                  />
                </div>
                <p className="mt-1 text-center text-[11px] font-bold text-gray-400">
                  시청권 1장 = 30분 · 카드를 고른 뒤 시청을 시작해요
                </p>
              </>
            ) : (
              <>
                <h3 className="text-center text-base font-black text-gray-800">시청 시작</h3>
                <div className="mt-2 flex justify-center">
                  <ContentVideoWatchBalanceRow
                    ticketQuantity={chestTicketQty}
                    watchTimeLabel={formatWatchTimeClock(
                      sessionId && remainingPlaySeconds > 0
                        ? remainingPlaySeconds
                        : displayWatchSeconds,
                    )}
                  />
                </div>
              </>
            )}
          </div>

          {/* ── 메뉴 (영상·미니게임 가로 배치) ── */}
          {phase === 'menu' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <ul className="flex flex-row items-stretch justify-center gap-3">
                {CHILD_CONTENT_MENU_ITEMS.map((item) => {
                  const available = isChildContentMenuAvailable(item.id, level)
                  const lockLabel = childContentMenuLockLabel(item.id)
                  return (
                    <li key={item.id} className="w-[min(42%,9.5rem)] max-w-[9.5rem]">
                      <button
                        type="button"
                        onClick={() => handleMenuSelect(item.id)}
                        className={`flex h-full w-full flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center shadow-sm transition ${
                          available
                            ? 'border-gray-100 bg-white active:scale-[0.99]'
                            : 'cursor-default border-gray-200 bg-gray-100 opacity-75'
                        }`}
                      >
                        {item.imageUrl ? (
                          <span
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border p-1.5 ${
                              available
                                ? 'border-gray-100 bg-white'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt=""
                              width={48}
                              height={48}
                              className={`h-full w-full object-contain ${available ? '' : 'grayscale'}`}
                              draggable={false}
                            />
                          </span>
                        ) : null}
                        <span className="flex flex-col items-center gap-0.5">
                          <span className="flex flex-wrap items-center justify-center gap-1">
                            <span
                              className={`text-[13px] font-black leading-tight ${
                                available ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
                              {item.title}
                            </span>
                          </span>
                          <span
                            className={`text-[10px] font-bold leading-snug ${
                              available ? 'text-gray-500' : 'text-gray-400'
                            }`}
                          >
                            {item.description}
                          </span>
                        </span>
                        <span className="relative inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center">
                          <ContentTicketCountChip
                            kind={item.id}
                            quantity={chestTicketQty}
                            size="sm"
                            numbersOnly
                            ariaHidden={!available}
                          />
                          {!available ? (
                            <span
                              className="absolute -inset-x-5 inset-y-0 flex items-center justify-center gap-1 rounded-md bg-gray-300 px-2 text-[9px] font-bold leading-none text-gray-600"
                              aria-label={lockLabel ?? '준비중'}
                            >
                              {lockLabel ? (
                                <>
                                  <span aria-hidden>🔒</span>
                                  {lockLabel}
                                </>
                              ) : (
                                '준비중'
                              )}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {comingSoonLabel ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[12px] font-bold text-amber-800">
                  {comingSoonLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ── 영상 채널 목록 (3열 그리드 · 세로 스크롤) ── */}
          {phase === 'browse' ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {channels.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-gray-400">준비된 영상이 없어요</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 pb-1">
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleChannelClick(ch)}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition active:scale-[0.98]"
                    >
                      <ContentChannelThumbnail
                        playlistUrl={ch.playlist_url}
                        storedThumbnailUrl={ch.thumbnail_url}
                      />
                      <div className="px-1.5 py-1.5">
                        <p className="line-clamp-2 text-[10px] font-black leading-snug text-gray-900">{ch.title}</p>
                        <p className="mt-0.5 truncate text-[9px] font-bold text-gray-400">{ch.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {phase === 'menu' ? (
            <div className="border-t border-gray-100 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleCloseOverlay}
                className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
              >
                닫기
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── 영상 선택 (이용권 사용 후) ── */}
      {phase === 'pickVideo' ? (
        <div className="relative z-[1] flex h-full w-full flex-col bg-black">
          <div className="absolute inset-x-0 top-0 z-[5] flex items-start justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={handleBackToBrowse}
              className={watchBackButtonClass}
              aria-label="채널 목록으로"
            >
              ←
            </button>
            <ContentWatchTimer
              remainingSec={remainingSec}
              paused={!isVideoPlaying}
              align="right"
            />
          </div>
          <div className="shrink-0 border-b border-white/10 px-4 pb-2 pt-[calc(max(4rem,env(safe-area-inset-top)+3.25rem))]">
            <h3 className="truncate text-center text-sm font-black text-white">
              {selectedChannel?.title ?? '영상 고르기'}
            </h3>
            <p className="mt-1 text-center text-[11px] font-bold text-white/60">
              보고 싶은 영상을 골라 주세요 · 재생할 때만 시간이 줄어요
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {videosLoading ? (
              <p className="py-12 text-center text-sm font-bold text-white/50">영상 목록 불러오는 중…</p>
            ) : playlistVideos.length === 0 ? (
              <p className="py-12 text-center text-sm font-bold text-white/50">영상 목록을 불러올 수 없어요</p>
            ) : (
              <ul className="flex flex-col gap-2 pb-2">
                {playlistVideos.map((video) => (
                  <li key={video.videoId}>
                    <button
                      type="button"
                      onClick={() => handlePickVideo(video)}
                      className="flex w-full items-center gap-3 rounded-xl bg-white/10 p-2 text-left transition active:scale-[0.99] active:bg-white/15"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={youtubeVideoThumbnailUrl(video.videoId)}
                        alt=""
                        width={144}
                        height={81}
                        className="h-[5.25rem] w-36 shrink-0 rounded-lg object-cover"
                        draggable={false}
                      />
                      <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-white line-clamp-2">
                        {video.title}
                      </span>
                      <span className="shrink-0 text-lg text-white/40" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* ── 시청 중 ── */}
      {phase === 'watching' && activeVideoId ? (
        <div className="relative z-[1] flex h-full w-full flex-col bg-black">
          <div className="absolute inset-x-0 top-0 z-[5] flex items-start justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={handleBackToVideoList}
              className="shrink-0 rounded-lg bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm"
              aria-label="영상 목록으로"
            >
              ← 목록
            </button>
            <ContentWatchTimer
              remainingSec={remainingSec}
              paused={!isVideoPlaying}
              align="right"
            />
          </div>
          <div className="min-h-0 flex-1 pt-[calc(max(3.5rem,env(safe-area-inset-top)+2.75rem))]">
            <ContentYouTubePlayer
              videoId={activeVideoId}
              title={selectedChannel?.title ?? '영상 재생'}
              onPlayingChange={setIsVideoPlaying}
            />
          </div>
        </div>
      ) : null}

      {/* ── 시간 종료 ── */}
      {phase === 'timeup' ? (
        <div className="relative z-[2] mx-auto flex h-full w-full max-w-xs flex-col items-center justify-center gap-4 bg-black/80 p-6">
          <p className="text-center text-lg font-black leading-snug text-white">
            약속한 시간이 다 됐어!
            <br />
            이제 뭘 해야할까?
          </p>
          <button
            type="button"
            onClick={() => {
              onClose()
              onGoToMissions()
            }}
            className="w-full max-w-xs rounded-2xl bg-amber-400 py-3.5 text-base font-black text-gray-900"
          >
            미션 하러 가기
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
