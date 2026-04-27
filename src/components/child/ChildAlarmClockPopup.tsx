'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import {
  addSeoulCalendarDays,
  getSeoulDateString,
} from '@/lib/koreaDate'
import {
  readRoutineAlarmPrefs,
  readRoutineHasSchoolFromStorage,
  type RoutineAlarmPrefsLoaded,
  type RoutineCustomAlarmStored,
} from '@/lib/routineAlarmLocalPrefs'
import { AUDIO } from '@/constants/audio'
import { CHILD_AUDIO } from '@/lib/childAudio'

type Props = {
  open: boolean
  onClose: () => void
}

type RoutineAlarmRow = {
  label: string
  time: string
  onWeekend: boolean
}

type NextAlarmResult = {
  label: string
  time: string
  atMs: number
}

const POMODORO_MINUTES = [1, 3, 5, 10, 15, 20, 25, 30] as const

/** 하단 알람 목록에서 숨길 기본 루틴 블록 라벨 */
const HIDDEN_BOTTOM_ALARM_LABELS = ['기상', '하원·귀가', '취침'] as const

/**
 * 뽀모도로 컨트롤 아이콘 — 글자 대신 재생 / 일시정지 / 정지(초기화) 모양만 표시합니다.
 * 비개발자: 왼쪽은 동영상처럼 재생(▶)과 멈춤(❚❚), 오른쪽은 완전히 끄는 정지(■) 느낌입니다.
 */
function PomodoroIconPlay({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  )
}
function PomodoroIconPause({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}
function PomodoroIconStop({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h12v12H6V6z" />
    </svg>
  )
}

/**
 * 알람 팝업(`MissionSleepMorningLayer`)과 같은 아침 해 스프라이트 아틀라스 좌표입니다.
 * - 비개발자용: 같은 원본 그림에서 같은 조각을 잘라 보여 줍니다.
 */
const MODE_ATLAS = {
  url: '/assets/img/common/ui/mode.png',
  w: 376,
  h: 175,
  morning: { x: 3, y: 3, w: 234, h: 169 },
} as const

/**
 * 서울 날짜 문자열(YYYY-MM-DD)을 받아 주말인지 판별합니다.
 * - 비개발자용: 토요일/일요일이면 true입니다.
 */
function isWeekendSeoulDate(isoDate: string): boolean {
  const [yy, mm, dd] = isoDate.split('-').map(Number)
  const utcNoonKst = Date.UTC(yy, mm - 1, dd, 3, 0, 0)
  const day = new Date(utcNoonKst).getUTCDay()
  return day === 0 || day === 6
}

/**
 * 시·분 문자열(HH:mm)과 서울 날짜를 합쳐 실제 시각(ms)으로 바꿉니다.
 * - 예: 2026-04-21 + 07:30 -> "2026-04-21T07:30:00+09:00"
 */
function toSeoulDateTimeMs(isoDate: string, hhmm: string): number {
  return new Date(`${isoDate}T${hhmm}:00+09:00`).getTime()
}

/**
 * 서울 기준 디지털 시계 — 시:분:초(24시) + 날짜 한 줄.
 * 비개발자: 숫자로만 된 시계(예: 14:05:09)와 아래에 날짜를 보여 줍니다.
 */
function formatSeoulDigitalClockParts(now: Date): { timeLine: string; dateLine: string } {
  const timeLine = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  const dateLine = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
    .format(now)
    .replace(/\./g, '')
    .trim()
  return { timeLine, dateLine }
}

/** 아침 알람 팝업과 동일한 해 이미지를 작게 표시하는 조각 컴포넌트입니다. */
function MorningAlarmSprite({ scale = 0.34 }: { scale?: number }) {
  const f = MODE_ATLAS.morning
  return (
    <div
      role="img"
      aria-label="아침 알람 이미지"
      className="shrink-0"
      style={{
        width: f.w * scale,
        height: f.h * scale,
        backgroundImage: `url(${MODE_ATLAS.url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${MODE_ATLAS.w * scale}px ${MODE_ATLAS.h * scale}px`,
        backgroundPosition: `${-f.x * scale}px ${-f.y * scale}px`,
      }}
    />
  )
}

/**
 * 루틴 알람 설정에서 실제로 울리는 알람 목록을 추립니다.
 * - 주중/주말 토글, 하원·귀가 표시 여부, 추가 알람을 함께 반영합니다.
 */
function buildRoutineAlarmRows(prefs: RoutineAlarmPrefsLoaded, hasSchool: boolean): RoutineAlarmRow[] {
  const rows: RoutineAlarmRow[] = []
  if (prefs.notifyWake) {
    rows.push({ label: '기상', time: prefs.wakeTime, onWeekend: prefs.wakeOnWeekend })
  }
  if (hasSchool && prefs.notifyReturn) {
    rows.push({ label: '하원·귀가', time: prefs.returnHomeTime, onWeekend: prefs.returnOnWeekend })
  }
  if (prefs.notifySleep) {
    rows.push({ label: '취침', time: prefs.sleepTime, onWeekend: prefs.sleepOnWeekend })
  }
  for (const c of prefs.customAlarms) {
    const custom = c as RoutineCustomAlarmStored
    if (!custom.notify) continue
    rows.push({
      label: custom.label || '추가 알람',
      time: custom.time,
      onWeekend: custom.onWeekend !== false,
    })
  }
  return rows.filter((r) => /^\d{2}:\d{2}$/.test(r.time))
}

/**
 * 다음 알람 1개를 계산합니다.
 * - 오늘~7일 내에서 가장 빠른 알람 시각을 찾아 남은 시간을 함께 반환합니다.
 */
function findNextAlarm(rows: RoutineAlarmRow[], nowMs: number): NextAlarmResult | null {
  if (rows.length === 0) return null
  const today = getSeoulDateString()
  let best: { label: string; time: string; atMs: number } | null = null
  for (const row of rows) {
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = addSeoulCalendarDays(today, offset)
      if (!row.onWeekend && isWeekendSeoulDate(date)) continue
      const atMs = toSeoulDateTimeMs(date, row.time)
      if (atMs < nowMs) continue
      if (!best || atMs < best.atMs) best = { label: row.label, time: row.time, atMs }
      break
    }
  }
  if (!best) return null
  return {
    ...best,
  }
}

export default function ChildAlarmClockPopup({ open, onClose }: Props) {
  const [portalReady, setPortalReady] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const touchStartXRef = useRef<number | null>(null)

  /** 뽀모도로 상태 */
  const [selectedMinutes, setSelectedMinutes] = useState<number>(5)
  const [secondsLeft, setSecondsLeft] = useState<number>(5 * 60)
  const [running, setRunning] = useState(false)
  /**
   * 자연 종료(00:00) 직후 — "확인"으로만 소리·화면을 정리하기 전 단계.
   * 비개발자: 타이머가 끝난 뒤 빨간 깜빡임과 확인 버튼이 나오는 상태입니다.
   */
  const [pomodoroAwaitingConfirm, setPomodoroAwaitingConfirm] = useState(false)

  /** 남은 10초 구간 알람 — 10초가 되는 순간 1회만 재생, 0초에서 끊음 */
  const pomodoroTenSecAlarmRef = useRef<HTMLAudioElement | null>(null)
  /** 타이머 00:00 직후 종료 멜로디(`HAPPY_COUNTDOWN`) — 확인·초기화에서 끊기 위해 보관 */
  const pomodoroEndMelodyRef = useRef<HTMLAudioElement | null>(null)
  /** 이번 실행에서 10초 알람을 이미 시작했는지(매 초 재시작 방지) */
  const tenSecondAlarmStartedRef = useRef(false)

  /**
   * 뽀모도로 10초 경고음 + 종료 멜로디를 모두 멈추고 플래그를 초기화합니다.
   * 비개발자: 정지(초기화)·확인·팝업 닫기에서 호출해 어떤 알람도 남지 않게 합니다.
   */
  const stopPomodoroSounds = useCallback(() => {
    pomodoroTenSecAlarmRef.current?.pause()
    if (pomodoroTenSecAlarmRef.current) pomodoroTenSecAlarmRef.current.currentTime = 0
    pomodoroEndMelodyRef.current?.pause()
    if (pomodoroEndMelodyRef.current) pomodoroEndMelodyRef.current.currentTime = 0
    pomodoroEndMelodyRef.current = null
    tenSecondAlarmStartedRef.current = false
    setPomodoroAwaitingConfirm(false)
  }, [])

  /** 루틴 알람 조회 상태 */
  const [alarmRows, setAlarmRows] = useState<RoutineAlarmRow[]>([])
  const [nowMs, setNowMs] = useState<number>(Date.now())

  useEffect(() => {
    setPortalReady(true)
  }, [])

  /**
   * 팝업이 열릴 때 부모앱에서 저장한 루틴 알람 설정(localStorage)을 읽어옵니다.
   * 비개발자용: 부모가 맞춰둔 기상/취침 시간을 아이 화면에서 그대로 보여줍니다.
   */
  useEffect(() => {
    if (!open) return
    const prefs = readRoutineAlarmPrefs()
    const hasSchool = readRoutineHasSchoolFromStorage()
    setAlarmRows(buildRoutineAlarmRows(prefs, hasSchool))
    /** 첫 화면 = 뽀모도로(slide 0). 알람 목록은 slide 1. */
    setSlideIndex(0)
  }, [open])

  /** 헤더 디지털 시계(초 단위) — 팝업이 열린 동안 1초마다 갱신합니다. */
  useEffect(() => {
    if (!open) return
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open])

  /**
   * 뽀모도로 카운트다운(1초 단위)
   * - 남은 시간이 10초가 되는 순간: 틱 알람을 **처음부터 1번만** 재생
   * - 0초: 10초 알람 끊음 → 종료 멜로디(`AUDIO.COUNTDOWN.HAPPY_COUNTDOWN`) 재생 → 00:00 UI + 확인
   */
  useEffect(() => {
    if (!open || !running) return
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false)
          if (prev === 1) {
            pomodoroTenSecAlarmRef.current?.pause()
            if (pomodoroTenSecAlarmRef.current) pomodoroTenSecAlarmRef.current.currentTime = 0
            setSlideIndex(0)
            setPomodoroAwaitingConfirm(true)
            pomodoroEndMelodyRef.current?.pause()
            const endAudio = new Audio(AUDIO.COUNTDOWN.HAPPY_COUNTDOWN)
            endAudio.volume = 0.85
            pomodoroEndMelodyRef.current = endAudio
            void endAudio.play().catch(() => {})
          }
          return 0
        }
        const next = prev - 1
        if (next === 10 && !tenSecondAlarmStartedRef.current) {
          tenSecondAlarmStartedRef.current = true
          let a = pomodoroTenSecAlarmRef.current
          if (!a) {
            a = new Audio(CHILD_AUDIO.tickTock)
            pomodoroTenSecAlarmRef.current = a
          }
          a.volume = 0.65
          a.currentTime = 0
          void a.play().catch(() => {})
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [open, running])

  /** 일시정지 시 10초 알람도 멈춤(재개는 시작 버튼에서 처리). */
  useEffect(() => {
    if (running) return
    pomodoroTenSecAlarmRef.current?.pause()
  }, [running])

  /** 팝업을 닫으면 타이머·알람 소리를 멈춰 예상치 못한 백그라운드 동작을 막습니다. */
  useEffect(() => {
    if (open) return
    setRunning(false)
    stopPomodoroSounds()
  }, [open, stopPomodoroSounds])

  const nextAlarm = useMemo(() => findNextAlarm(alarmRows, nowMs), [alarmRows, nowMs])
  const { timeLine: seoulDigitalTime, dateLine: seoulDigitalDate } = useMemo(
    () => formatSeoulDigitalClockParts(new Date(nowMs)),
    [nowMs],
  )
  /** 하단 리스트는 요청사항에 따라 기본 루틴(기상/하원·귀가/취침)을 제외합니다. */
  const visibleBottomAlarmRows = useMemo(
    () =>
      alarmRows.filter(
        (row) =>
          !HIDDEN_BOTTOM_ALARM_LABELS.includes(row.label as (typeof HIDDEN_BOTTOM_ALARM_LABELS)[number]),
      ),
    [alarmRows],
  )
  const minutesLeft = Math.floor(secondsLeft / 60)
  const remainSeconds = secondsLeft % 60
  /** 00:00 도달 후 확인 전 — 빨간 깜빡임·확인 버튼 전용 */
  const pomodoroFinishedUi = pomodoroAwaitingConfirm && secondsLeft === 0

  if (!open || !portalReady) return null

  const overlay = (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="뽀모도로·알람"
    >
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      {/**
       * 중앙 모달 — 예전 하단 시트(`items-end`, `rounded-t-3xl`) 대신 화면 가운데 카드로 띄웁니다.
       * 비개발자: 아래에서 올라오는 창이 아니라 가운데 뜨는 흰 카드입니다.
       */}
      <div className="relative z-[1] mx-auto flex h-auto max-h-[min(85dvh,calc(100vh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-4 pb-3 pt-4">
          <p className="text-center text-sm font-black text-gray-900">뽀모도로 · 알람</p>
          {/**
           * 서울 기준 디지털 시계 — 아날로그 원판 대신 큰 숫자(시:분:초)로 표시합니다.
           */}
          <div className="mt-2 text-center" role="timer" aria-live="polite" aria-atomic="true">
            <p className="text-3xl font-black tabular-nums tracking-tight text-slate-900 sm:text-4xl">{seoulDigitalTime}</p>
            <p className="mt-1 text-[12px] font-bold text-gray-600">{seoulDigitalDate}</p>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-500">좌우로 밀어 루틴 알람 일정을 볼 수 있어요.</p>
        </div>

        <div
          className="min-h-0 flex-1 overflow-hidden"
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            const startX = touchStartXRef.current
            const endX = e.changedTouches[0]?.clientX ?? null
            touchStartXRef.current = null
            if (startX == null || endX == null) return
            const delta = endX - startX
            if (delta <= -40) setSlideIndex(1)
            if (delta >= 40) setSlideIndex(0)
          }}
        >
          <div
            className="flex h-full w-[200%] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slideIndex * 50}%)` }}
          >
            {/* 페이지 1: 뽀모도로(첫 화면) */}
            <section className="h-full w-1/2 overflow-y-auto px-4 py-4" aria-label="뽀모도로 타이머">
              <div className="mb-3 flex items-center gap-2">
                <SpriteImage sheet={ICONS} frame="timer" width={24} className="shrink-0 select-none" />
                <h3 className="text-sm font-black text-gray-800">뽀모도로 타이머</h3>
              </div>

              <div
                className={`rounded-2xl px-4 py-4 text-center transition-colors ${
                  pomodoroFinishedUi ? 'bg-rose-50 ring-2 ring-red-200/80' : 'bg-sky-50'
                }`}
              >
                <p
                  className={`text-[11px] font-bold ${pomodoroFinishedUi ? 'text-red-700' : 'text-sky-700'}`}
                >
                  남은 시간
                </p>
                <p
                  className={`mt-1 text-3xl font-black tabular-nums ${
                    pomodoroFinishedUi
                      ? 'animate-pulse text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.55)]'
                      : 'text-sky-900'
                  }`}
                >
                  {String(minutesLeft).padStart(2, '0')}:{String(remainSeconds).padStart(2, '0')}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {POMODORO_MINUTES.map((m) => {
                  const selected = selectedMinutes === m
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={pomodoroAwaitingConfirm}
                      onClick={() => {
                        stopPomodoroSounds()
                        setSelectedMinutes(m)
                        setSecondsLeft(m * 60)
                        setRunning(false)
                      }}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected ? 'border-[#4A90E2] bg-[#4A90E2] text-white' : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      {m}분
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={pomodoroAwaitingConfirm}
                  onClick={() => {
                    setRunning((was) => {
                      const next = !was
                      if (next && tenSecondAlarmStartedRef.current && secondsLeft <= 10 && secondsLeft > 0) {
                        const a = pomodoroTenSecAlarmRef.current
                        if (a) void a.play().catch(() => {})
                      }
                      return next
                    })
                  }}
                  className="flex flex-1 items-center justify-center rounded-xl bg-[#4A90E2] py-3 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                  aria-label={running ? '일시정지' : '시작'}
                >
                  {running ? <PomodoroIconPause /> : <PomodoroIconPlay />}
                </button>
                {pomodoroAwaitingConfirm ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopPomodoroSounds()
                      setSecondsLeft(selectedMinutes * 60)
                    }}
                    className="flex flex-1 items-center justify-center rounded-xl bg-red-500 py-3 text-sm font-black text-white shadow-sm"
                    aria-label="뽀모도로 종료 확인 — 알람 끄고 시간 초기화"
                  >
                    확인
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      stopPomodoroSounds()
                      setRunning(false)
                      setSecondsLeft(selectedMinutes * 60)
                    }}
                    className="flex flex-1 items-center justify-center rounded-xl bg-gray-100 py-3 text-gray-700"
                    aria-label="초기화 — 타이머를 처음 시간으로 되돌리고 알람을 모두 멈춤"
                  >
                    <PomodoroIconStop />
                  </button>
                )}
              </div>
            </section>

            {/* 페이지 2: 루틴 알람 */}
            <section className="h-full w-1/2 overflow-y-auto px-4 py-4" aria-label="루틴 알람 정보">
              <h3 className="text-sm font-black text-gray-800">알람</h3>

              <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                {/** 카드 높이를 줄이기 위해 텍스트는 왼쪽, 알람 이미지는 오른쪽에 배치합니다. */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {nextAlarm ? (
                      <>
                        {/**
                         * 요청사항:
                         * - "다음 알람" 문구 삭제
                         * - 상단에는 알람 종류(기상/취침/하원·귀가), 아래에는 시간만 표시
                         */}
                        <p className="text-sm font-black text-gray-900">{nextAlarm.label}</p>
                        <p className="mt-1 text-xl font-black tabular-nums text-[#4A90E2]">{nextAlarm.time}</p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-gray-500">설정된 알람이 없어요</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <MorningAlarmSprite />
                  </div>
                </div>
              </div>

              {visibleBottomAlarmRows.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {visibleBottomAlarmRows.map((row, idx) => (
                    <li key={`${row.label}-${row.time}-${idx}`} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                      <p className="text-xs font-bold text-gray-800">{row.label}</p>
                      <p className="text-sm font-black tabular-nums text-gray-900">{row.time}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSlideIndex(0)}
              className={`h-2.5 w-2.5 rounded-full ${slideIndex === 0 ? 'bg-[#4A90E2]' : 'bg-gray-300'}`}
              aria-label="뽀모도로 화면으로 이동"
            />
            <button
              type="button"
              onClick={() => setSlideIndex(1)}
              className={`h-2.5 w-2.5 rounded-full ${slideIndex === 1 ? 'bg-[#4A90E2]' : 'bg-gray-300'}`}
              aria-label="루틴 알람 화면으로 이동"
            />
          </div>
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700">
            닫기
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
