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

/** 루틴 도우미 패널 안 「주간 루틴」탭 전용 단계 — 부모가 뒤로가기와 동기화합니다 */
export type RoutinePanelWizardStep = 'route' | 'weekday' | 'weekend' | 'holiday' | 'holiday_direct' | 'done'

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
  /**
   * embedded 이고 true 일 때: 주중 → 주말 선택 → 저장까지 안내형 단계 UI.
   * `wizardStep` / `onWizardStepChange` 는 이 경우 **필수**입니다.
   */
  embeddedPanelWizard?: boolean
  wizardStep?: RoutinePanelWizardStep
  onWizardStepChange?: (step: RoutinePanelWizardStep) => void
  /** true면 저장 성공 후 `onClose` 를 호출하지 않습니다(패널에 완료 화면 유지). */
  suppressCloseAfterSuccess?: boolean
}

export default function RoutineKeywordBuilderSheet({
  open,
  onClose,
  linkedChildId,
  hasSchool,
  routineMissions,
  onSuccess,
  embedded = false,
  embeddedPanelWizard = false,
  wizardStep = 'route',
  onWizardStepChange,
  suppressCloseAfterSuccess = false,
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

  /** DB 반영 공통 — 휴일 모드·휴일 칩만 바꿔 넣을 수 있습니다 */
  const postSave = useCallback(
    async (opts: {
      holidayMode: 'as_weekday' | 'custom'
      holidayAmOverride?: string[]
      holidayPmOverride?: string[]
    }) => {
      if (!linkedChildId) {
        setError('자녀를 먼저 선택해 주세요')
        return
      }
      const prefs = readRoutineAlarmPrefs()
      const soundRes = await fetch('/api/assets/alarm-sounds')
      const soundJson = await soundRes.json().catch(() => ({}))
      const list = Array.isArray(soundJson.sounds) ? soundJson.sounds : []
      const firstSound = (list[0] as { id?: string } | undefined)?.id ?? ''
      const mode = opts.holidayMode
      const hAm = mode === 'custom' ? (opts.holidayAmOverride ?? holidayAm) : []
      const hPm = mode === 'custom' ? (opts.holidayPmOverride ?? holidayPm) : []

      await postRoutineKeywordMissions(fetch, {
        linkedChildId,
        weekdayAm,
        weekdayPm,
        holidayMode: mode,
        holidayAm: hAm,
        holidayPm: hPm,
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
      await router.refresh()
      onSuccess?.()
      if (!suppressCloseAfterSuccess) onClose()
    },
    [
      linkedChildId,
      weekdayAm,
      weekdayPm,
      holidayAm,
      holidayPm,
      hasSchool,
      router,
      onSuccess,
      onClose,
      suppressCloseAfterSuccess,
    ],
  )

  /** 시트 기본 저장 — 화면에 보이는 휴일 모드 그대로 */
  const submit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await postSave({ holidayMode: holidayRoutineMode })
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션을 만들지 못했어요')
    } finally {
      setSubmitting(false)
    }
  }, [holidayRoutineMode, postSave])

  /** 위저드 「주중과 같게」— 주중 칩만 쓰고 휴일은 평일과 동일 */
  const submitWeekdayCopyToHoliday = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await postSave({ holidayMode: 'as_weekday' })
      if (embeddedPanelWizard && onWizardStepChange) onWizardStepChange('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션을 만들지 못했어요')
    } finally {
      setSubmitting(false)
    }
  }, [embeddedPanelWizard, onWizardStepChange, postSave])

  /** 위저드 마지막 단계 — 휴일 칩 커스텀 저장 */
  const submitHolidayCustom = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await postSave({ holidayMode: 'custom' })
      if (embeddedPanelWizard && onWizardStepChange) onWizardStepChange('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션을 만들지 못했어요')
    } finally {
      setSubmitting(false)
    }
  }, [embeddedPanelWizard, onWizardStepChange, postSave])

  if (!open) return null

  /** 패널 위저드: 처음엔 주중/주말 중 무엇을 설정할지 고릅니다 */
  const wizardRoutePick = embedded && embeddedPanelWizard && wizardStep === 'route' && onWizardStepChange

  /** 패널 위저드: 평일 칩만 — 다음 단계로 넘김 */
  const wizardWeekdayBody = embedded && embeddedPanelWizard && wizardStep === 'weekday' && onWizardStepChange

  /** 패널 위저드: 주말을 평일과 같게 할지, 따로 할지 */
  const wizardWeekendBody = embedded && embeddedPanelWizard && wizardStep === 'weekend' && onWizardStepChange

  /** 패널 위저드: 휴일 전용 칩 (주중 설정을 마친 뒤 또는 처음부터 주말만 고른 경우) */
  const wizardHolidayBody =
    embedded && embeddedPanelWizard && (wizardStep === 'holiday' || wizardStep === 'holiday_direct')

  /** 패널 위저드: 저장까지 끝난 안내 */
  const wizardDoneBody = embedded && embeddedPanelWizard && wizardStep === 'done'

  const card = (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden bg-white shadow-2xl ${
        embedded ? 'h-full max-h-full rounded-xl border border-gray-100' : 'max-h-[88vh] rounded-t-2xl'
      }`}
    >
      {/* 하단 시트일 때만 손잡이 — 패널 임베드는 상단 여백만 최소로 둡니다 */}
      {embedded && embeddedPanelWizard ? (
        <div className="h-1 shrink-0" aria-hidden />
      ) : (
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
      )}
      {!(embedded && embeddedPanelWizard) ? (
        <div className="border-b border-gray-100 px-4 pb-2 pt-3">
          <p id="kw-sheet-title" className="text-center text-sm font-black text-gray-900">
            키워드로 루틴 추가
          </p>
        </div>
      ) : (
        <div className="sr-only" id="kw-sheet-title">
          키워드로 루틴 추가
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-2">
        {wizardDoneBody ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/90 px-3 py-6 text-center shadow-sm ring-1 ring-emerald-100/80">
            <p className="text-sm font-black text-emerald-900">루틴이 업데이트됐어요!</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-white py-2.5 text-xs font-black text-emerald-900 shadow ring-1 ring-emerald-100"
              onClick={() => onWizardStepChange?.('route')}
            >
              확인
            </button>
          </div>
        ) : null}

        {wizardRoutePick ? (
          <div className="space-y-3">
            <p className="text-center text-xs font-bold leading-relaxed text-gray-700">
              스텝 1: 루틴 유형을 선택해 주세요
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className="rounded-2xl border border-sky-200 bg-sky-50/95 px-3 py-3 text-center text-sm font-black text-sky-950 shadow-sm active:scale-[0.99]"
                onClick={() => onWizardStepChange('weekday')}
              >
                주중 루틴
              </button>
              <button
                type="button"
                className="rounded-2xl border border-violet-200 bg-violet-50/95 px-3 py-3 text-center text-sm font-black text-violet-950 shadow-sm active:scale-[0.99]"
                onClick={() => {
                  setHolidayRoutineMode('custom')
                  onWizardStepChange('holiday_direct')
                }}
              >
                주말/공휴일 루틴
              </button>
            </div>
          </div>
        ) : null}

        {wizardWeekdayBody ? (
          <div className="space-y-2">
            <p className="text-center text-xs font-bold text-gray-800">주중에 할 루틴을 선택해 주세요.</p>
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
          </div>
        ) : null}

        {wizardWeekendBody ? (
          <div className="space-y-3">
            <p className="text-center text-sm font-black text-gray-900">주말과 공휴일 루틴은 어떻게 할까요?</p>
            <p className="text-center text-[11px] font-medium leading-relaxed text-gray-600">
              주말/공휴일에는 평소와 다른 루틴을 설정할 수 있어요.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={submitting}
                className="rounded-2xl border border-sky-200 bg-sky-50 py-3 text-xs font-black text-sky-950 shadow-sm disabled:opacity-50"
                onClick={() => void submitWeekdayCopyToHoliday()}
              >
                주중과 같게
              </button>
              <button
                type="button"
                className="rounded-2xl border border-violet-200 bg-violet-50 py-3 text-xs font-black text-violet-950 shadow-sm"
                onClick={() => {
                  setHolidayRoutineMode('custom')
                  onWizardStepChange('holiday')
                }}
              >
                따로 설정하기
              </button>
            </div>
          </div>
        ) : null}

        {wizardHolidayBody ? (
          <div className="space-y-2">
            <p className="text-center text-xs font-bold text-gray-800">
              {wizardStep === 'holiday_direct'
                ? '주말과 공휴일에 할 루틴을 선택해 주세요.'
                : '주말/공휴일 루틴을 골라 주세요.'}
            </p>
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

        {/* 기존 시트(비위저드) 또는 패널에서 위저드가 아닐 때 — 평일+휴일 한 화면 */}
        {!embeddedPanelWizard ? (
          <>
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
          </>
        ) : null}

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}
      </div>

      {embedded && embeddedPanelWizard ? (
        <div className="shrink-0 border-t border-gray-100 px-3 py-3">
          {wizardWeekdayBody ? (
            <button
              type="button"
              disabled={submitting}
              className="w-full rounded-xl bg-[#4A90E2] py-3 text-xs font-black text-white shadow-sm disabled:opacity-50"
              onClick={() => onWizardStepChange?.('weekend')}
            >
              다음 → 주말 루틴 설정
            </button>
          ) : null}
          {wizardHolidayBody ? (
            <button
              type="button"
              disabled={submitting}
              className="w-full rounded-xl bg-[#4A90E2] py-3 text-xs font-black text-white shadow-sm disabled:opacity-50"
              onClick={() => void submitHolidayCustom()}
            >
              {submitting ? '저장 중…' : '저장하기'}
            </button>
          ) : null}
          {wizardRoutePick || wizardWeekendBody || wizardDoneBody ? null : (
            <p className="text-center text-[10px] text-gray-400">상단의 뒤로 버튼으로 이전 단계로 갈 수 있어요.</p>
          )}
        </div>
      ) : (
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
      )}
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
