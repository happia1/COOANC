'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

/** 서울 기준 현재 날짜/시간 문장을 만듭니다. (예: 2026년 04월 21일 · 08:30) */
function formatSeoulDateTimeLabel(now: Date): string {
  const dateText = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/\./g, '')
    .trim()
  const timeText = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  return `${dateText} · ${timeText}`
}

/**
 * 서울 기준 현재 시각을 바늘 각도로 변환합니다.
 * - 시침: 시 + 분/60 + 초/3600
 * - 분침: 분 + 초/60
 * - 초침: 초
 */
function getSeoulAnalogAngles(now: Date): { hourDeg: number; minuteDeg: number; secondDeg: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour24 = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? '0')
  const hour12 = hour24 % 12
  return {
    hourDeg: hour12 * 30 + minute * 0.5 + second * (0.5 / 60),
    minuteDeg: minute * 6 + second * 0.1,
    secondDeg: second * 6,
  }
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
    setSlideIndex(0)
  }, [open])

  /** 루틴 알람 "남은 시간"을 30초 주기로 업데이트합니다. */
  useEffect(() => {
    if (!open) return
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [open])

  /** 뽀모도로 카운트다운(1초 단위) */
  useEffect(() => {
    if (!open || !running) return
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [open, running])

  /** 팝업을 닫으면 타이머를 멈춰 예상치 못한 백그라운드 동작을 막습니다. */
  useEffect(() => {
    if (open) return
    setRunning(false)
  }, [open])

  const nextAlarm = useMemo(() => findNextAlarm(alarmRows, nowMs), [alarmRows, nowMs])
  /** 헤더 표시는 nowMs를 재사용해 추가 타이머 없이 함께 갱신합니다. */
  const nowDateTimeLabel = useMemo(() => formatSeoulDateTimeLabel(new Date(nowMs)), [nowMs])
  const analogAngles = useMemo(() => getSeoulAnalogAngles(new Date(nowMs)), [nowMs])
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

  if (!open || !portalReady) return null

  const overlay = (
    <div className="fixed inset-0 z-[160] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="시계 메뉴">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[min(86dvh,100vh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="border-b border-gray-100 px-4 pb-3 pt-3">
          <p className="text-center text-sm font-black text-gray-900">시계</p>
          <p className="mt-1 text-center text-[12px] font-bold tabular-nums text-gray-700">{nowDateTimeLabel}</p>
          {/**
           * 비개발자용: 기존 단순 원형 대신, 바깥 링/안쪽 링/12개 눈금을 가진
           * 클래식 시계판으로 바꿔 한눈에 시계처럼 보이게 합니다.
           */}
          <div className="mt-2 flex justify-center">
            <div
              className="relative h-24 w-24 rounded-full border-2 border-slate-300 bg-white shadow-[0_4px_10px_rgba(15,23,42,0.12)]"
              role="img"
              aria-label="현재 시각 아날로그 시계"
            >
              <span className="absolute inset-2 rounded-full border border-slate-200 bg-white" />
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={`tick-${i}`}
                  className="absolute left-1/2 top-1/2 block bg-slate-400"
                  style={{
                    width: i % 3 === 0 ? '2px' : '1px',
                    height: i % 3 === 0 ? '6px' : '3px',
                    borderRadius: '999px',
                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-33px)`,
                    opacity: i % 3 === 0 ? 0.9 : 0.55,
                  }}
                />
              ))}

              {/* 가독성을 위해 핵심 숫자(12/3/6/9)를 선명하게 표시합니다. */}
              <span className="absolute left-1/2 top-[12px] -translate-x-1/2 text-[10px] font-black text-slate-700">12</span>
              <span className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700">3</span>
              <span className="absolute bottom-[12px] left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-700">6</span>
              <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700">9</span>

              <span
                className="absolute left-1/2 top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-[95%] rounded-full bg-slate-800"
                style={{ transform: `translate(-50%, -95%) rotate(${analogAngles.hourDeg}deg)`, transformOrigin: '50% 95%' }}
              />
              <span
                className="absolute left-1/2 top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-[95%] rounded-full bg-[#4A90E2]"
                style={{ transform: `translate(-50%, -95%) rotate(${analogAngles.minuteDeg}deg)`, transformOrigin: '50% 95%' }}
              />
              <span
                className="absolute left-1/2 top-1/2 h-7.5 w-[1px] -translate-x-1/2 -translate-y-[95%] rounded-full bg-rose-500"
                style={{ transform: `translate(-50%, -95%) rotate(${analogAngles.secondDeg}deg)`, transformOrigin: '50% 95%' }}
              />
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700 ring-2 ring-white" />
            </div>
          </div>
          <p className="mt-1 text-center text-[11px] text-gray-500">좌우로 밀어서 뽀모도로 / 루틴 알람을 볼 수 있어요.</p>
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
            {/* 페이지 1: 시계(루틴 알람) */}
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

            {/* 페이지 2: 뽀모도로 */}
            <section className="h-full w-1/2 overflow-y-auto px-4 py-4" aria-label="뽀모도로 타이머">
              <div className="mb-3 flex items-center gap-2">
                <SpriteImage sheet={ICONS} frame="timer" width={24} className="shrink-0 select-none" />
                <h3 className="text-sm font-black text-gray-800">뽀모도로 타이머</h3>
              </div>

              <div className="rounded-2xl bg-sky-50 px-4 py-4 text-center">
                <p className="text-[11px] font-bold text-sky-700">남은 시간</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-sky-900">
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
                      onClick={() => {
                        setSelectedMinutes(m)
                        setSecondsLeft(m * 60)
                        setRunning(false)
                      }}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold ${
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
                  onClick={() => setRunning((v) => !v)}
                  className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-sm font-black text-white"
                >
                  {running ? '일시정지' : '시작'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false)
                    setSecondsLeft(selectedMinutes * 60)
                  }}
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
                >
                  초기화
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSlideIndex(0)}
              className={`h-2.5 w-2.5 rounded-full ${slideIndex === 0 ? 'bg-[#4A90E2]' : 'bg-gray-300'}`}
              aria-label="시계 화면으로 이동"
            />
            <button
              type="button"
              onClick={() => setSlideIndex(1)}
              className={`h-2.5 w-2.5 rounded-full ${slideIndex === 1 ? 'bg-[#4A90E2]' : 'bg-gray-300'}`}
              aria-label="뽀모도로 화면으로 이동"
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
