'use client'

/**
 * 루틴 탭용 하단 시트 — 온보딩 2단계와 같은 「키워드 칩」으로 일상 미션을 한꺼번에 만듭니다.
 * 시트를 열 때는 DB에 있는 이 자녀 일상(키워드) 미션·휴일 모드와 칩을 맞춥니다.
 * 저장 시 기존 키워드 루틴을 비운 뒤 다시 넣어 목록·토글과 충돌이 나지 않게 합니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Mission } from '@/types/database'
import {
  AM_CHIPS,
  PM_CHIPS,
  deriveRoutineKeywordUiState,
  postRoutineKeywordMissions,
  toggleChipIdLoose,
  type ChipDef,
} from '@/lib/routineChips'
import { readRoutineAlarmPrefs } from '@/lib/routineAlarmLocalPrefs'

type Props = {
  open: boolean
  onClose: () => void
  /** 이 자녀에게만 묶인 미션으로 생성 */
  linkedChildId: string | null
  /** 등원 칩을 보일지(유치원·학교 등) */
  hasSchool: boolean
  /** 루틴 탭에서 넘기는 이 자녀 일상 미션(스페셜 제외) — 열 때 칩 동기화 */
  routineMissions: Mission[]
  onSuccess?: () => void
  /**
   * true: 전체 화면 딤 없이 패널 안에만 카드 본문을 둡니다(루틴 도우미 탭 재사용).
   * false(기본): 기존 하단 시트와 동일합니다.
   */
  embedded?: boolean
}

export default function RoutineKeywordBuilderSheet({
  open,
  onClose,
  linkedChildId,
  hasSchool,
  routineMissions,
  onSuccess,
  embedded = false,
}: Props) {
  const router = useRouter()
  const [weekdayAm, setWeekdayAm] = useState<string[]>([])
  const [weekdayPm, setWeekdayPm] = useState<string[]>([])
  const [holidayAm, setHolidayAm] = useState<string[]>([])
  const [holidayPm, setHolidayPm] = useState<string[]>([])
  const [holidayRoutineMode, setHolidayRoutineMode] = useState<'as_weekday' | 'custom'>('as_weekday')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 닫힌 뒤 다시 열릴 때만 DB 기준으로 칩·휴일 모드 복원 */
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    const s = deriveRoutineKeywordUiState({
      missions: routineMissions,
      childId: linkedChildId,
      hasSchool,
    })
    setWeekdayAm(s.weekdayAm)
    setWeekdayPm(s.weekdayPm)
    setHolidayAm(s.holidayAm)
    setHolidayPm(s.holidayPm)
    setHolidayRoutineMode(s.holidayRoutineMode)
    setError(null)
  }, [open, hasSchool, linkedChildId, routineMissions])

  const submit = useCallback(async () => {
    if (!linkedChildId) {
      setError('자녀를 먼저 선택해 주세요')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const prefs = readRoutineAlarmPrefs()
      const soundRes = await fetch('/api/assets/alarm-sounds')
      const soundJson = await soundRes.json().catch(() => ({}))
      const list = Array.isArray(soundJson.sounds) ? soundJson.sounds : []
      const firstSound = (list[0] as { id?: string } | undefined)?.id ?? ''

      await postRoutineKeywordMissions(fetch, {
        linkedChildId,
        weekdayAm,
        weekdayPm,
        holidayMode: holidayRoutineMode,
        holidayAm: holidayRoutineMode === 'custom' ? holidayAm : [],
        holidayPm: holidayRoutineMode === 'custom' ? holidayPm : [],
        hasSchool,
        wakeTime: prefs.wakeTime,
        sleepTime: prefs.sleepTime,
        returnHomeTime: prefs.returnHomeTime,
        notifyWake: prefs.notifyWake,
        notifyReturn: prefs.notifyReturn,
        notifySleep: prefs.notifySleep,
        soundWake: prefs.soundWake || firstSound,
        soundReturn: prefs.soundReturn || firstSound,
        soundSleep: prefs.soundSleep || firstSound,
        customAlarms: prefs.customAlarms,
      })
      router.refresh()
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션을 만들지 못했어요')
    } finally {
      setSubmitting(false)
    }
  }, [
    linkedChildId,
    weekdayAm,
    weekdayPm,
    holidayRoutineMode,
    holidayAm,
    holidayPm,
    hasSchool,
    router,
    onSuccess,
    onClose,
  ])

  if (!open) return null

  const card = (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden bg-white shadow-2xl ${
        embedded ? 'h-full max-h-full rounded-xl border border-gray-100' : 'max-h-[88vh] rounded-t-2xl'
      }`}
    >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="border-b border-gray-100 px-4 pb-2 pt-3">
          <p id="kw-sheet-title" className="text-center text-sm font-black text-gray-900">
            키워드로 루틴 추가
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-2">
          <div>
            <p className="text-xs font-black text-gray-900">평일 루틴</p>
            <BlockSection label="오전">
              <HorizontalChips
                pool={AM_CHIPS}
                selectedIds={weekdayAm}
                hasSchool={hasSchool}
                fixedChipsToggleable
                onToggle={(id) => setWeekdayAm((prev) => toggleChipIdLoose(AM_CHIPS, prev, id))}
              />
            </BlockSection>
            <BlockSection label="오후">
              <HorizontalChips
                pool={PM_CHIPS}
                selectedIds={weekdayPm}
                hasSchool={hasSchool}
                fixedChipsToggleable
                onToggle={(id) => setWeekdayPm((prev) => toggleChipIdLoose(PM_CHIPS, prev, id))}
              />
            </BlockSection>
          </div>

          <div>
            <p className="text-xs font-black text-gray-900">휴일 루틴</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <HolidayModeOption
                label="평일과 같아요"
                sub="같은 일상 미션을 써요"
                selected={holidayRoutineMode === 'as_weekday'}
                onClick={() => setHolidayRoutineMode('as_weekday')}
              />
              <HolidayModeOption
                label="휴일만 따로"
                sub="미션을 따로 만듭니다"
                selected={holidayRoutineMode === 'custom'}
                onClick={() => setHolidayRoutineMode('custom')}
              />
            </div>
            {holidayRoutineMode === 'custom' ? (
              <div className="mt-2 space-y-2">
                <BlockSection label="오전 (휴일)">
                  <HorizontalChips
                    pool={AM_CHIPS}
                    selectedIds={holidayAm}
                    hasSchool={false}
                    fixedChipsToggleable
                    onToggle={(id) => setHolidayAm((prev) => toggleChipIdLoose(AM_CHIPS, prev, id))}
                  />
                </BlockSection>
                <BlockSection label="오후 (휴일)">
                  <HorizontalChips
                    pool={PM_CHIPS}
                    selectedIds={holidayPm}
                    hasSchool={false}
                    fixedChipsToggleable
                    onToggle={(id) => setHolidayPm((prev) => toggleChipIdLoose(PM_CHIPS, prev, id))}
                  />
                </BlockSection>
              </div>
            ) : null}
          </div>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {submitting ? '만드는 중…' : '이 자녀 루틴에 추가'}
          </button>
        </div>
      </div>
  )

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" role="region" aria-labelledby="kw-sheet-title">
        {card}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="kw-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      {card}
    </div>
  )
}

/** 칩 묶음 제목 + 흰 카드 */
function BlockSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
      <p className="mb-1.5 text-xs font-black text-gray-900">{label}</p>
      {children}
    </div>
  )
}

/**
 * 가로 스크롤 칩
 * - fixedChipsToggleable 이 false(기본): 기상·취침은 항상 파란 스타일·해제 불가
 * - true: DB와 맞춤용 — 고정 칩도 끄면 회색으로 보임
 */
function HorizontalChips({
  pool,
  selectedIds,
  hasSchool,
  fixedChipsToggleable = false,
  onToggle,
}: {
  pool: ChipDef[]
  selectedIds: string[]
  hasSchool: boolean
  /** true면 기상·취침도 일반 칩처럼 선택/해제 */
  fixedChipsToggleable?: boolean
  onToggle: (id: string, isFixed: boolean) => void
}) {
  const setSel = new Set(selectedIds)
  const visible = pool.filter((c) => !c.hideWhenNoSchool || hasSchool)
  return (
    <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <div className="flex w-max min-w-full snap-x snap-mandatory gap-2 px-1">
        {visible.map((chip) => {
          const selected = setSel.has(chip.id)
          const isFixed = chip.type === 'fixed'
          // 고정 칩을 잠글 때(온보딩 등): 항상 파란색 — 시트(DB 맞춤)에서는 fixedChipsToggleable 로 잠금 해제
          const lockedFixedStyle = isFixed && !fixedChipsToggleable
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onToggle(chip.id, isFixed)}
              className={[
                'snap-start shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all',
                lockedFixedStyle
                  ? 'cursor-default border-[#4A90E2] bg-[#4A90E2]/10 text-[#4A90E2]'
                  : selected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-400',
                fixedChipsToggleable && isFixed ? 'cursor-pointer' : '',
              ].join(' ')}
            >
              {chip.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HolidayModeOption({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string
  sub?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-w-0 rounded-xl border bg-white px-2 py-2 text-center shadow-sm transition-all active:scale-[0.99]',
        selected ? 'border-[#4A90E2] ring-1 ring-[#4A90E2]/25' : 'border-gray-100 hover:border-[#4A90E2]/30',
      ].join(' ')}
    >
      <p className="text-[11px] font-bold leading-tight text-gray-900">{label}</p>
      {sub ? <p className="mt-1 text-[9px] leading-snug text-gray-400">{sub}</p> : null}
    </button>
  )
}
