'use client'

/**
 * CalendarViewModal — 감정 그림일기 월별 달력
 * emotion_diary 기록이 있는 날은 face_id + color_hex 로 작은 이모티콘 표시
 */

import { useEffect, useMemo, useState } from 'react'
import { emotionFaceEmoji, fetchEmotionDiaryForMonth, type EmotionDiaryRow } from '@/lib/emotionDiary'
import { getSeoulDateString, getSeoulWeekdayShort } from '@/lib/koreaDate'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

type Props = {
  open: boolean
  onClose: () => void
  childId: string
  /** 달력에서 날짜를 고르면 DiaryModal 로 전달 */
  onSelectDate: (dateKey: string) => void
  /** 강조할 「오늘」(서울 YYYY-MM-DD) */
  today?: string
}

export default function CalendarViewModal({
  open,
  onClose,
  childId,
  onSelectDate,
  today = getSeoulDateString(),
}: Props) {
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1)
  const [entries, setEntries] = useState<EmotionDiaryRow[]>([])

  useEffect(() => {
    if (!open) return
    const [ty, tm] = today.split('-').map(Number)
    setYear(ty)
    setMonth(tm - 1)
  }, [open, today])

  useEffect(() => {
    if (!open || !childId) return
    let cancelled = false
    void fetchEmotionDiaryForMonth(childId, year, month).then((rows) => {
      if (!cancelled) setEntries(rows)
    })
    return () => {
      cancelled = true
    }
  }, [open, childId, year, month])

  const byDate = useMemo(() => {
    const map = new Map<string, EmotionDiaryRow>()
    for (const e of entries) map.set(e.diary_date, e)
    return map
  }, [entries])

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysCount = new Date(year, month + 1, 0).getDate()
    const list: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysCount }, (_, i) => i + 1)]
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [year, month])

  if (!open) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const monthLabel = `${year}년 ${month + 1}월`

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function dateKey(day: number): string {
    return `${year}-${pad(month + 1)}-${pad(day)}`
  }

  return (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="감정 일기 달력"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl ring-2 ring-amber-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500"
          aria-label="닫기"
        >
          ×
        </button>

        <div className="mb-3 flex items-center justify-between gap-2 pr-10">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-800"
          >
            ‹
          </button>
          <p className="text-base font-black text-gray-800">{monthLabel}</p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-800"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day == null) return <div key={`e-${idx}`} className="aspect-square" />
            const dk = dateKey(day)
            const entry = byDate.get(dk)
            const isToday = dk === today
            const wd = getSeoulWeekdayShort(dk)
            return (
              <button
                key={dk}
                type="button"
                onClick={() => {
                  onSelectDate(dk)
                  onClose()
                }}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition-colors ${
                  isToday ? 'bg-violet-100 ring-2 ring-violet-300' : 'bg-gray-50 hover:bg-amber-50'
                }`}
                aria-label={`${dk} ${wd}요일${entry ? ', 감정 기록 있음' : ''}`}
              >
                <span className={isToday ? 'text-violet-700' : 'text-gray-700'}>{day}</span>
                {entry ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] shadow-sm"
                    style={{ backgroundColor: entry.color_hex }}
                  >
                    {emotionFaceEmoji(entry.face_id)}
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded-full border border-dashed border-gray-200 bg-white" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
