'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CHILD_CONTENT_MENU_ITEMS,
  isChildContentMenuAvailable,
  MINIGAME_UNLOCK_LEVEL,
  type ChildContentMenuItemId,
} from '@/constants/childContentMenu'
import ContentChannelThumbnail from '@/components/child/ContentChannelThumbnail'
import { ContentVideoWatchBalanceRow } from '@/components/child/ContentTicketBalanceDisplay'
import ContentWatchTimer from '@/components/child/ContentWatchTimer'
import ContentYouTubePlayer from '@/components/child/ContentYouTubePlayer'
import type { ContentCategory, ContentChannel, ContentSession } from '@/types/database'
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
  /** 채널을 묶는 교육 카테고리 — 카테고리 선택 → 채널 선택 순으로 탐색 */
  categories: ContentCategory[]
  /** 자녀 현재 레벨 — 미니게임 메뉴 레벨 게이트(10)에 사용 */
  level: number
  /** 영상 시청·인형뽑기 미니게임 공용 「보물상자 티켓」 수량 */
  initialChestTicketQuantity: number
  initialActiveSession: ContentSession | null
  /** 「미션 하러 가기」 — 미션 카드 영역으로 스크롤 */
  onGoToMissions: () => void
  /** 티켓 0장 상태에서 메뉴를 눌렀을 때 — 팝업을 닫고 마켓 콘텐츠 구역으로 이동 */
  onOpenMarket: () => void
  onChestTicketQuantityChange: (quantity: number) => void
  /** 인형뽑기 그랩 API 요청 중임을 ChildScreen의 pendingStatsWritesRef 카운터에 알림 */
  onClawGrabPending: (pending: boolean) => void
  /** 인형뽑기로 받은 하트·크레딧을 ChildScreen의 stats에 반영 */
  onClawStatsSynced: (patch: Record<string, unknown>) => void
}

/**
 * menu · browse(카테고리 선택) · browseChannels(카테고리 안 채널 선택) ·
 * pickVideo(영상 선택) · watching · timeup · clawMachine(인형뽑기)
 */
type Phase = 'menu' | 'browse' | 'browseChannels' | 'pickVideo' | 'watching' | 'timeup' | 'clawMachine'

type ClawPrize =
  | { type: 'hearts'; amount: number }
  | { type: 'credits'; amount: number }
  | { type: 'seed'; treeId: string }
  | { type: 'ticket'; amount: number }
  | { type: 'snack'; storeItemId: string; storeItemName: string; storeItemImageUrl: string | null }

type ClawSlotData = { position: number; prize: ClawPrize }
/** 유리장 6칸 — 고정 길이 배열, 당첨된 자리는 null(위치 정보는 그대로 유지) */
type ClawSlot = ClawSlotData | null

const CLAW_SLOT_COUNT = 6
/** 좌/우 버튼 1회 탭당 이동량(%) — 히트 반경(~12.5%) 대비 슬롯 사이를 충분히 세밀하게 조준 가능 */
const CLAW_STEP_PCT = 4

const CLAW_PRIZE_ICON: Record<ClawPrize['type'], string> = {
  hearts: '❤️',
  credits: '🪙',
  seed: '🌱',
  ticket: '🎟️',
  snack: '🍪',
}

function clawPrizeLabel(prize: ClawPrize): string {
  switch (prize.type) {
    case 'hearts':
      return `하트 +${prize.amount}`
    case 'credits':
      return `크레딧 +${prize.amount}`
    case 'seed':
      return '화분 씨앗 1개'
    case 'ticket':
      return `보물상자 티켓 +${prize.amount}`
    case 'snack':
      return prize.storeItemName
  }
}

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
  categories,
  level,
  initialChestTicketQuantity,
  initialActiveSession,
  onGoToMissions,
  onOpenMarket,
  onChestTicketQuantityChange,
  onClawGrabPending,
  onClawStatsSynced,
}: Props) {
  const [portalReady, setPortalReady] = useState(false)
  const [chestTicketQty, setChestTicketQty] = useState(initialChestTicketQuantity)
  const [phase, setPhase] = useState<Phase>('menu')
  /** 잠긴 메뉴(레벨 미달)를 눌렀을 때 잠깐 보여줄 안내 문구 */
  const [lockHint, setLockHint] = useState<string | null>(null)
  /** browse(카테고리 목록)에서 고른 카테고리 — browseChannels 에서 그 안의 채널만 보여줌 */
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)
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

  // ── 인형뽑기(클로우 머신) ──────────────────────────────────────────────
  const [clawSessionId, setClawSessionId] = useState<string | null>(null)
  const [clawSlots, setClawSlots] = useState<ClawSlot[]>([])
  const [clawTriesLeft, setClawTriesLeft] = useState(5)
  const [clawPosition, setClawPosition] = useState(50)
  const [clawBusy, setClawBusy] = useState(false)
  const [clawReveal, setClawReveal] = useState<{ hit: boolean; prize?: ClawPrize } | null>(null)
  const [clawSessionOver, setClawSessionOver] = useState(false)
  const [clawWonThisSession, setClawWonThisSession] = useState<ClawPrize[]>([])

  const totalAvailableSeconds = watchSecondsPool + (sessionId ? remainingPlaySeconds : 0)
  const displayWatchSeconds = totalVideoWatchSecondsFromBalances(
    chestTicketQty,
    watchSecondsPool,
    sessionId ? remainingPlaySeconds : 0,
  )

  /** 카테고리 key → 그 안의 채널 목록(채널이 1개도 없는 카테고리는 목록에서 제외) */
  const categoriesWithChannels = useMemo(() => {
    const byKey = new Map<string, ContentChannel[]>()
    for (const ch of channels) {
      const key = ch.category_key || 'etc'
      const list = byKey.get(key)
      if (list) list.push(ch)
      else byKey.set(key, [ch])
    }
    const ordered = categories
      .filter((cat) => byKey.has(cat.key))
      .map((cat) => ({ category: cat, channels: byKey.get(cat.key) ?? [] }))
    // 카테고리 테이블에 없는 category_key(데이터 정합성 예외)도 놓치지 않게 뒤에 붙임
    for (const [key, list] of byKey) {
      if (ordered.some((g) => g.category.key === key)) continue
      ordered.push({ category: { id: key, key, label: key, order_index: 999 }, channels: list })
    }
    return ordered
  }, [channels, categories])

  const channelsInSelectedCategory = useMemo(() => {
    if (!selectedCategoryKey) return []
    return categoriesWithChannels.find((g) => g.category.key === selectedCategoryKey)?.channels ?? []
  }, [categoriesWithChannels, selectedCategoryKey])

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

  /** 영상 리스트에서 뒤로 — 남은 시간 저장 후 (카테고리 안) 채널 목록으로 */
  const handleBackToBrowse = useCallback(() => {
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    void saveSessionProgress(remainingSecRef.current)
    setPhase('browseChannels')
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
    setSelectedCategoryKey(null)
    setSelectedChannel(null)
    setActiveVideoId(null)
    setIsVideoPlaying(false)
    setPlaylistVideos([])
    setTimerInitialRemaining(null)
  }, [])

  /** 채널 목록(browseChannels)에서 카테고리 목록으로 — 세션은 유지, 선택만 초기화 */
  const backToCategoryList = useCallback(() => {
    setSelectedCategoryKey(null)
    setPhase('browse')
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
          if (phase === 'menu' || phase === 'browse' || phase === 'browseChannels') {
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
    if (!isChildContentMenuAvailable(id, level)) {
      setLockHint(`레벨 ${MINIGAME_UNLOCK_LEVEL}에 열려요`)
      window.setTimeout(() => setLockHint(null), 2000)
      return
    }

    if (chestTicketQty <= 0) {
      onClose()
      onOpenMarket()
      return
    }

    if (id === 'video') {
      setPhase('browse')
    } else if (id === 'minigame') {
      void startClawSession()
    }
  }

  async function startClawSession() {
    if (clawBusy) return
    setClawBusy(true)
    onClawGrabPending(true)
    try {
      const res = await fetch('/api/child/minigame/claw-session-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        sessionId?: string
        layout?: ClawSlotData[]
        triesLeft?: number
        chestTicketQuantity?: number
      }
      if (!res.ok || !json.sessionId) {
        window.alert(json.error ?? '게임을 시작할 수 없어요')
        return
      }
      const slots: ClawSlot[] = Array.from({ length: CLAW_SLOT_COUNT }, (_, i) =>
        (json.layout ?? []).find((s) => s.position === i) ?? null,
      )
      setClawSessionId(json.sessionId)
      setClawSlots(slots)
      setClawTriesLeft(typeof json.triesLeft === 'number' ? json.triesLeft : 5)
      setClawPosition(50)
      setClawSessionOver(false)
      setClawWonThisSession([])
      setClawReveal(null)
      if (typeof json.chestTicketQuantity === 'number') {
        syncChestTicketQty(json.chestTicketQuantity)
      }
      setPhase('clawMachine')
    } finally {
      setClawBusy(false)
      onClawGrabPending(false)
    }
  }

  function nudgeClaw(direction: -1 | 1) {
    if (clawBusy || clawReveal) return
    setClawPosition((p) => Math.max(0, Math.min(100, p + direction * CLAW_STEP_PCT)))
  }

  async function handleClawGrab() {
    if (clawBusy || clawReveal || clawTriesLeft <= 0 || !clawSessionId) return
    setClawBusy(true)
    onClawGrabPending(true)
    try {
      const res = await fetch('/api/child/minigame/claw-grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, sessionId: clawSessionId, clawPosition }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        hit?: boolean
        prize?: ClawPrize
        wonPosition?: number
        triesLeft?: number
        sessionStatus?: 'active' | 'completed'
        statsPatch?: Record<string, unknown>
        chestTicketQuantity?: number
      }
      if (!res.ok) {
        window.alert(json.error ?? '뽑기에 실패했어요')
        return
      }

      const hit = Boolean(json.hit)
      const prize = json.prize
      setClawReveal({ hit, prize })
      if (typeof json.triesLeft === 'number') setClawTriesLeft(json.triesLeft)
      if (hit && prize && typeof json.wonPosition === 'number') {
        const wonPosition = json.wonPosition
        setClawSlots((prev) => prev.map((s) => (s && s.position === wonPosition ? null : s)))
        setClawWonThisSession((prev) => [...prev, prize])
      }
      if (json.statsPatch) onClawStatsSynced(json.statsPatch)
      if (typeof json.chestTicketQuantity === 'number') syncChestTicketQty(json.chestTicketQuantity)

      const sessionCompleted = json.sessionStatus === 'completed'
      window.setTimeout(() => {
        setClawReveal(null)
        if (sessionCompleted) setClawSessionOver(true)
      }, 1500)
    } finally {
      setClawBusy(false)
      onClawGrabPending(false)
    }
  }

  function handleClawExit() {
    setPhase('menu')
    setClawSessionId(null)
    setClawSlots([])
    setClawSessionOver(false)
    setClawWonThisSession([])
    setClawReveal(null)
  }

  function handleCategoryClick(categoryKey: string) {
    setSelectedCategoryKey(categoryKey)
    setPhase('browseChannels')
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
        setPhase('browseChannels')
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
    if (phase === 'watching' || phase === 'pickVideo' || phase === 'clawMachine') return
    if ((phase === 'browse' || phase === 'browseChannels') && sessionId && remainingSecRef.current > 0) {
      void saveSessionProgress(remainingSecRef.current).finally(() => onClose())
      return
    }
    onClose()
  }

  const showModal = phase === 'menu' || phase === 'browse' || phase === 'browseChannels'

  if (!open || !portalReady) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[165] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="보물상자 콘텐츠"
    >
      {phase !== 'watching' && phase !== 'pickVideo' && phase !== 'timeup' && phase !== 'clawMachine' ? (
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
            phase === 'browse' || phase === 'browseChannels'
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
                  시청권 1장 = 30분 · 보고 싶은 종류를 먼저 골라 주세요
                </p>
              </>
            ) : phase === 'browseChannels' ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={backToCategoryList}
                    className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-600"
                    aria-label="카테고리로 돌아가기"
                  >
                    ← 종류
                  </button>
                  <h3 className="flex-1 truncate text-center text-base font-black text-gray-800">
                    {categoriesWithChannels.find((g) => g.category.key === selectedCategoryKey)?.category
                      .label ?? '영상 보기'}
                  </h3>
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
                  return (
                    <li key={item.id} className="w-[min(42%,9.5rem)] max-w-[9.5rem]">
                      <button
                        type="button"
                        onClick={() => handleMenuSelect(item.id)}
                        aria-label={available ? item.title : `${item.title} — 레벨 ${MINIGAME_UNLOCK_LEVEL}에 열려요`}
                        className={`flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center shadow-sm transition ${
                          available ? 'active:scale-[0.99]' : 'cursor-default opacity-60'
                        }`}
                      >
                        {item.imageUrl ? (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white p-1.5">
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
                          <span className="text-[13px] font-black leading-tight text-gray-900">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-bold leading-snug text-gray-500">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {lockHint ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[12px] font-bold text-amber-800">
                  {lockHint}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ── 카테고리 목록 (2열 그리드 · 세로 스크롤) ── */}
          {phase === 'browse' ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {categoriesWithChannels.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-gray-400">준비된 영상이 없어요</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 pb-1">
                  {categoriesWithChannels.map(({ category, channels: chsInCategory }) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => handleCategoryClick(category.key)}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition active:scale-[0.98]"
                    >
                      <ContentChannelThumbnail
                        playlistUrl={chsInCategory[0].playlist_url}
                        storedThumbnailUrl={chsInCategory[0].thumbnail_url}
                      />
                      <div className="px-2 py-1.5">
                        <p className="line-clamp-1 text-[11px] font-black leading-snug text-gray-900">
                          {category.label}
                        </p>
                        <p className="mt-0.5 truncate text-[9px] font-bold text-gray-400">
                          채널 {chsInCategory.length}개
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* ── 카테고리 안 채널 목록 (3열 그리드 · 세로 스크롤) ── */}
          {phase === 'browseChannels' ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {channelsInSelectedCategory.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-gray-400">준비된 영상이 없어요</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 pb-1">
                  {channelsInSelectedCategory.map((ch) => (
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
                        {ch.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[9px] font-bold leading-snug text-gray-400">
                            {ch.description}
                          </p>
                        ) : null}
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

      {/* ── 인형뽑기(클로우 머신) ── */}
      {phase === 'clawMachine' ? (
        <div className="relative z-[1] flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex w-full flex-col items-center gap-2">
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={handleClawExit}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-[12px] font-bold text-white"
                aria-label="메뉴로 돌아가기"
              >
                ← 메뉴
              </button>
              <h3 className="text-base font-black text-white">인형뽑기</h3>
              <span className="w-[52px]" aria-hidden />
            </div>
            <div className="flex items-center gap-1.5" aria-label={`남은 시도 ${clawTriesLeft}번`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${i < clawTriesLeft ? 'bg-rose-400' : 'bg-white/20'}`}
                  aria-hidden
                />
              ))}
            </div>
          </div>

          <div className="relative flex w-full flex-1 items-center">
            <div className="relative mx-auto w-full max-w-sm rounded-2xl border-4 border-white/20 bg-white/5 py-8 shadow-inner">
              <div className="grid grid-cols-6 gap-1 px-2">
                {clawSlots.map((slot, i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-lg bg-white/10 text-2xl"
                  >
                    {slot ? CLAW_PRIZE_ICON[slot.prize.type] : ''}
                  </div>
                ))}
              </div>
              <div
                className="pointer-events-none absolute top-0 -translate-x-1/2 text-2xl transition-[left] duration-150"
                style={{ left: `${clawPosition}%` }}
                aria-hidden
              >
                🪝
              </div>
            </div>
          </div>

          <div className="flex w-full max-w-sm items-center justify-center gap-4 pb-2">
            <button
              type="button"
              onClick={() => nudgeClaw(-1)}
              disabled={clawBusy || Boolean(clawReveal)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl font-black text-white disabled:opacity-40"
              aria-label="클로우 왼쪽으로"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => void handleClawGrab()}
              disabled={clawBusy || Boolean(clawReveal) || clawTriesLeft <= 0}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-sm font-black text-white shadow-lg disabled:opacity-40"
              aria-label="뽑기"
            >
              뽑기
            </button>
            <button
              type="button"
              onClick={() => nudgeClaw(1)}
              disabled={clawBusy || Boolean(clawReveal)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl font-black text-white disabled:opacity-40"
              aria-label="클로우 오른쪽으로"
            >
              ▶
            </button>
          </div>

          {clawReveal ? (
            <div className="absolute inset-0 z-[3] flex items-center justify-center bg-black/60">
              <div className="flex flex-col items-center gap-2 rounded-3xl bg-white px-8 py-6 shadow-2xl">
                {clawReveal.hit && clawReveal.prize ? (
                  <>
                    <span className="text-4xl">{CLAW_PRIZE_ICON[clawReveal.prize.type]}</span>
                    <p className="text-center text-base font-black text-gray-900">
                      {clawPrizeLabel(clawReveal.prize)}
                    </p>
                  </>
                ) : (
                  <p className="text-center text-lg font-black text-gray-500">꽝!</p>
                )}
              </div>
            </div>
          ) : null}

          {clawSessionOver ? (
            <div className="absolute inset-0 z-[4] flex flex-col items-center justify-center gap-4 bg-black/80 p-6">
              <p className="text-center text-lg font-black text-white">뽑기가 끝났어요!</p>
              {clawWonThisSession.length > 0 ? (
                <ul className="flex flex-col items-center gap-1">
                  {clawWonThisSession.map((prize, i) => (
                    <li key={i} className="text-sm font-bold text-white/90">
                      {CLAW_PRIZE_ICON[prize.type]} {clawPrizeLabel(prize)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-bold text-white/70">이번엔 못 뽑았어요, 다음에 또 해봐요!</p>
              )}
              <button
                type="button"
                onClick={handleClawExit}
                className="mt-2 w-full max-w-xs rounded-2xl bg-amber-400 py-3.5 text-base font-black text-gray-900"
              >
                메뉴로 돌아가기
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
