'use client'

/**
 * DiaryModal — 자녀 그림일기 다이어리
 *
 * 진입: 자녀 홈 캐릭터 터치 (ChildScreen) — 모바일 하단 시트 / 데스크톱 우측 슬라이드 패널
 *
 * 현재 구현 범위 (Phase 1):
 *   - 왼쪽(모바일: 위): 아이 프로필 카드
 *   - 오른쪽(모바일: 아래): 오늘의 그림일기 (감정카드 잠금 UI)
 *   - 달력보기 버튼 → CalendarViewModal
 *
 * Phase 2 예정:
 *   - 감정카드 실제 입력 (Lv.10 해금, 에셋 연동 후)
 *   - 텍스트 일기 입력
 *   - 사진 첨부
 *   - 음성 받아쓰기 → 텍스트 변환
 *
 * 에셋 경로 (디자인 완료 후 교체):
 *   /assets/diary/diary_open.png  — 다이어리 배경 이미지
 *   /assets/emotion/faces/        — 표정 PNG
 *   /assets/emotion/shapes/       — 모양 PNG
 *   /assets/emotion/colors.ts     — 색상 hex 상수
 *
 * DB: emotion_diary 테이블 (supabase/migrations/010_emotion_diary.sql)
 *
 * @deprecated EmotionCardLockedModal — 감정카드 잠금 UI는 이 모달 오른쪽 페이지로 통합됨
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { publicUrlForChildProfileAvatar } from '@/lib/childProfileAvatar'
import { getSeoulDateString, getSeoulWeekdayShort } from '@/lib/koreaDate'
import {
  DIARY_BG_URL,
  isDiaryBackgroundCachedAvailable,
  probeDiaryBackgroundAvailable,
} from '@/lib/diaryBackground'
import CalendarViewModal from '@/components/child/CalendarViewModal'
import {
  CHILD_ZONES,
  getChildBadge,
  getChildZone,
} from '@/constants/childGrowthLevels'
import type { DiaryModalProps } from '@/types/diaryModal'

export type { DiaryChildProfile, DiaryModalProps } from '@/types/diaryModal'

const SHEET_ANIM_MS = 300
/** 이 거리(px) 이상 끌면 닫기 */
const SWIPE_CLOSE_PX = 56

/** 모바일: 아래로 / 데스크톱: 오른쪽으로 끌어 닫기 */
function useDiarySheetDrag(onClose: () => void, enabled: boolean) {
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragWide, setDragWide] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const dragPxRef = useRef(0)

  const resetDrag = useCallback(() => {
    setDragPx(0)
    dragPxRef.current = 0
    setDragging(false)
    startRef.current = null
  }, [])

  useEffect(() => {
    dragPxRef.current = dragPx
  }, [dragPx])

  useEffect(() => {
    if (enabled) resetDrag()
  }, [enabled, resetDrag])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      const wide = window.matchMedia('(min-width: 768px)').matches
      setDragWide(wide)
      startRef.current = { x: e.clientX, y: e.clientY }
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !startRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      const next = dragWide ? Math.max(0, dx) : Math.max(0, dy)
      setDragPx(next)
      dragPxRef.current = next
    },
    [dragWide, enabled],
  )

  const finishDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* 캡처 없음 */
      }
      if (dragPxRef.current >= SWIPE_CLOSE_PX) onClose()
      else resetDrag()
    },
    [enabled, onClose, resetDrag],
  )

  const onPointerCancel = useCallback(() => resetDrag(), [resetDrag])

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel,
  }

  return { dragPx, dragging, dragWide, dragHandlers, resetDrag }
}

/** CSS fallback — 배경 PNG 로드 전·에셋 없을 때 즉시 표시 */
function DiaryFallbackBackground() {
  return (
    <div className="absolute inset-0 flex flex-col md:flex-row" aria-hidden>
      <div className="h-[20%] w-full bg-amber-50 md:h-full md:w-[38%]" />
      <div className="h-[80%] w-full border-t border-amber-200/60 bg-white md:h-full md:flex-1 md:border-l md:border-t-0" />
    </div>
  )
}

function formatDiaryDateBlock(iso: string): { ymd: string; weekday: string } {
  const [y, mo, d] = iso.split('-').map(Number)
  if (!y || !mo || !d) return { ymd: iso, weekday: '' }
  return {
    ymd: `${y}. ${mo}. ${d}.`,
    weekday: `${getSeoulWeekdayShort(iso)}요일`,
  }
}

const WEATHER_OPTIONS = [
  { id: 'sunny', icon: '☀️', label: '맑음' },
  { id: 'cloudy', icon: '⛅', label: '흐림' },
  { id: 'snow', icon: '❄️', label: '눈' },
  { id: 'rain', icon: '🌧️', label: '비' },
] as const

const MOOD_OPTIONS = [
  { id: 'happy', emoji: '😊', label: '기쁨' },
  { id: 'calm', emoji: '😌', label: '평온' },
  { id: 'excited', emoji: '🤩', label: '신남' },
  { id: 'sad', emoji: '😢', label: '슬픔' },
  { id: 'angry', emoji: '😤', label: '화남' },
] as const

/** 그림일기 — 위: 날짜·날씨 / 테두리 안: 표정 + 그리기 */
function PictureDiaryCanvas({
  dateIso,
  onOpenCalendar,
}: {
  dateIso: string
  onOpenCalendar: () => void
}) {
  const [weatherId, setWeatherId] = useState<string | null>(null)
  const [moodId, setMoodId] = useState<string | null>(null)
  const { ymd, weekday } = formatDiaryDateBlock(dateIso)

  return (
    <div className="flex min-h-[10rem] flex-1 flex-col">
      <div className="mb-1.5 flex shrink-0 items-start justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-start gap-1">
          <button
            type="button"
            onClick={onOpenCalendar}
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-sm ring-1 ring-violet-200"
            aria-label="달력으로 보기"
          >
            📅
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black leading-tight text-gray-800">{ymd}</p>
            {weekday ? <p className="text-[10px] font-bold text-gray-600">{weekday}</p> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex justify-end gap-0.5">
            {WEATHER_OPTIONS.map(({ id, icon, label }) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={weatherId === id}
                onClick={() => setWeatherId(weatherId === id ? null : id)}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors ${
                  weatherId === id ? 'bg-amber-100 ring-1 ring-amber-300' : 'bg-white/80 ring-1 ring-gray-200'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col rounded-xl border-2 border-dashed border-amber-200/90 bg-amber-50/10"
        aria-label="그림일기 그리기 및 사진 첨부 영역"
      >
      <div className="shrink-0 border-b border-amber-200/50 px-2 py-1.5">
        <p className="text-[9px] font-bold text-gray-400">오늘 기분이 어때?</p>
        <div className="mt-0.5 flex justify-center gap-1">
          {MOOD_OPTIONS.map(({ id, emoji, label }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={moodId === id}
              onClick={() => setMoodId(moodId === id ? null : id)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors ${
                moodId === id ? 'bg-violet-100 ring-2 ring-violet-300' : 'bg-white ring-1 ring-gray-200'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[5rem] flex-1 flex-col items-center justify-center gap-0.5 p-2 text-center">
        <span className="text-lg opacity-50" aria-hidden>
          🎨
        </span>
        <p className="text-[10px] font-bold text-amber-900/60">손으로 그리거나 사진을 붙여요</p>
      </div>
      </div>
    </div>
  )
}

/** 하단 미디어 도구 — 한 줄 배치 */
function DiaryMediaToolbar() {
  const tools = [
    { icon: '🎤', label: '음성 입력' },
    { icon: '⏺️', label: '녹음' },
    { icon: '🖼️', label: '이미지' },
  ] as const

  return (
    <div className="mt-2 flex shrink-0 gap-1.5">
      {tools.map(({ icon, label }) => (
        <button
          key={label}
          type="button"
          disabled
          title="곧 추가될 예정이에요"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl bg-gray-50 px-1 py-1.5 opacity-40 ring-1 ring-gray-200"
        >
          <span className="text-base leading-none" aria-hidden>
            {icon}
          </span>
          <span className="truncate text-[9px] font-bold text-gray-600">{label}</span>
        </button>
      ))}
    </div>
  )
}

/** 왼쪽 프로필 — 해당 레벨 뱃지(없으면 null) */
function DiaryEarnedBadge({ level }: { level: number }) {
  const badge = getChildBadge(level)
  if (!badge) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
      🏅 {badge.badge}
    </span>
  )
}

/** 왼쪽 프로필 — 존별 미니 여정 지도 */
function DiaryMiniJourneyMap({ level }: { level: number }) {
  const zone = getChildZone(level)
  return (
    <div className="mt-2 w-full rounded-xl bg-white/50 p-3">
      <p className="text-[10px] font-bold text-gray-600">나의 여정</p>
      <div className="mt-2 flex flex-wrap items-end justify-center gap-1">
        {CHILD_ZONES.map((z, i) => {
          const isCurrent = z.zone === zone.zone
          const reached = z.minLevel <= level
          return (
            <div key={z.zone} className="flex items-center gap-1">
              <div
                className={[
                  'flex flex-col items-center transition-all',
                  isCurrent ? 'scale-125 opacity-100' : reached ? 'opacity-100' : 'opacity-30',
                ].join(' ')}
              >
                {isCurrent ? (
                  <span className="mb-0.5 text-[8px] font-semibold text-gray-500">현재</span>
                ) : (
                  <span className="mb-0.5 h-[10px]" aria-hidden />
                )}
                <span className="text-lg leading-none">{z.emoji}</span>
                {isCurrent ? (
                  <span className="mt-0.5 text-[9px] font-bold text-gray-700">{z.zone}</span>
                ) : null}
              </div>
              {i < CHILD_ZONES.length - 1 ? (
                <span className="pb-1 text-xs text-gray-300" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProfileRow({ icon, label, value, compact }: { icon: string; label: string; value: string; compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex min-w-0 items-center gap-1 text-xs leading-snug text-gray-800">
        <span className="text-sm" aria-hidden>
          {icon}
        </span>
        <span className="shrink-0 font-bold text-amber-700/75">{label}</span>
        <span className="truncate font-black">{value}</span>
      </p>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 ring-1 ring-amber-100">
      <span className="text-base" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 text-left">
        <p className="text-[9px] font-bold text-amber-700/80">{label}</p>
        <p className="truncate text-xs font-black text-gray-800">{value}</p>
      </div>
    </div>
  )
}

export default function DiaryModal({
  open,
  onClose,
  childId,
  childProfile,
  initialDate,
  onInitialDateChange,
}: DiaryModalProps) {
  const cachedBg = isDiaryBackgroundCachedAvailable()
  const [bgImageAvailable, setBgImageAvailable] = useState<boolean | null>(cachedBg)
  const [bgImageLoaded, setBgImageLoaded] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)
  const { dragPx, dragging, dragWide, dragHandlers, resetDrag } = useDiarySheetDrag(onClose, visible)

  const { name, avatarUrl, ageYears, currentLevel } = childProfile

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    resetDrag()
    const timer = window.setTimeout(() => setMounted(false), SHEET_ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [open, resetDrag])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  useEffect(() => {
    if (!open) {
      setCalendarOpen(false)
      setBgImageLoaded(false)
      return
    }
    let cancelled = false
    void probeDiaryBackgroundAvailable().then((ok) => {
      if (!cancelled) setBgImageAvailable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!mounted) return null

  const ageLabel = ageYears != null ? `만 ${ageYears}세` : '—'
  const avatarSrc = avatarUrl || publicUrlForChildProfileAvatar('bunny_profile.png')

  const panelTransform =
    dragPx > 0 ? (dragWide ? `translateX(${dragPx}px)` : `translateY(${dragPx}px)`) : undefined

  const panelTransition = dragging ? 'transition-none' : 'transition-transform duration-300 ease-out'

  return (
    <>
      <div
        className={`fixed inset-0 z-[270] ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!visible}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="그림일기 닫기"
          onClick={onClose}
        />

        <div
          className={[
            'absolute flex flex-col overflow-hidden bg-white shadow-2xl',
            'bottom-0 left-0 right-0 h-[92dvh] max-h-[92dvh] rounded-t-3xl',
            'md:bottom-0 md:top-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-full md:max-w-[680px] md:rounded-none md:rounded-l-3xl',
            panelTransition,
            dragPx === 0 && (visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'),
          ]
            .filter(Boolean)
            .join(' ')}
          style={panelTransform ? { transform: panelTransform } : undefined}
          role="dialog"
          aria-modal="true"
          aria-label="그림일기 다이어리"
        >
          {/* 데스크톱: 왼쪽 가장자리 스와이프로 닫기 */}
          <div
            className="absolute bottom-0 left-0 top-0 z-50 hidden w-3 cursor-ew-resize touch-none select-none md:block"
            aria-hidden
            {...dragHandlers}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <DiaryFallbackBackground />
            {bgImageAvailable ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={DIARY_BG_URL}
                alt=""
                decoding="async"
                fetchPriority="high"
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                  bgImageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setBgImageLoaded(true)}
                onError={() => setBgImageAvailable(false)}
              />
            ) : null}

            <div
              className="pointer-events-none absolute right-0 top-[20%] bottom-0 z-[1] bg-white md:inset-y-0 md:top-0 md:left-[38%] lg:left-[34%]"
              aria-hidden
            />

            <div
              className="relative z-50 flex shrink-0 touch-none select-none flex-col md:hidden"
              {...dragHandlers}
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200/90" aria-hidden />
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col md:h-full md:flex-row">
                <section className="flex max-h-[36dvh] min-h-[20dvh] w-full shrink-0 flex-row items-center gap-2.5 overflow-y-auto bg-amber-50/90 pl-6 pr-3 py-2 md:h-full md:max-h-none md:w-[38%] md:flex-col md:justify-center md:gap-2.5 md:overflow-visible md:px-3 md:pb-3 md:pt-7 lg:w-[34%]">
                  <div
                    className="flex min-w-0 flex-1 touch-none select-none flex-row items-center gap-2.5 md:pointer-events-none md:contents"
                    {...dragHandlers}
                  >
                  <div className="relative h-[7.5rem] w-[7.5rem] shrink-0">
                    <Image src={avatarSrc} alt="" fill className="object-contain object-bottom" sizes="120px" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1 pl-3 md:flex md:w-full md:max-w-[9.5rem] md:flex-col md:items-center md:pl-0 md:text-center">
                    <h2 className="truncate text-sm font-black text-amber-900">{name}</h2>
                    <div className="mt-0.5 flex flex-col gap-px md:w-full">
                      <ProfileRow compact icon="🎂" label="나이" value={ageLabel} />
                      <ProfileRow compact icon="⭐" label="레벨" value={`Lv.${currentLevel}`} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 md:justify-center">
                      <DiaryEarnedBadge level={currentLevel} />
                    </div>
                    <DiaryMiniJourneyMap level={currentLevel} />
                  </div>
                  </div>
                </section>

                <section className="relative flex min-h-0 w-full flex-1 flex-col bg-white md:h-full md:flex-1">
                  <div className="flex min-h-0 flex-1 flex-col p-3.5 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4 md:pb-4 md:pt-4">
                    <PictureDiaryCanvas dateIso={initialDate} onOpenCalendar={() => setCalendarOpen(true)} />
                    <DiaryMediaToolbar />
                  </div>
                </section>
              </div>
            </div>

            {/* Phase 1 — 팝업 전체 잠금 (정식 앱에서 해제) */}
            <div
              className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-6"
              aria-hidden
            >
              <p className="text-center text-sm font-black leading-snug text-white drop-shadow-md md:text-base">
                🔒 정식 앱버전 반영 예정
              </p>
            </div>
          </div>
        </div>
      </div>

      <CalendarViewModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        childId={childId}
        today={getSeoulDateString()}
        onSelectDate={(dk) => {
          onInitialDateChange(dk)
        }}
      />
    </>
  )
}
