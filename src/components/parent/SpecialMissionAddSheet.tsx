'use client'

/**
 * 스페셜 미션 시트 — 키워드 칩으로 고른 뒤 「데일리」면 매일 자동(daily+special), 아니면 이벤트(event).
 * 저장 시 템플릿만 생성·수정·삭제합니다.
 * 이벤트형은 루틴 탭 스페셜 카드의 「오늘 일정에 넣기」로 그날만 자녀 화면에 넣을 수 있어요.
 * 데일리 스페셜은 자녀 미션 탭이 템플릿을 보고 오늘 행을 채워 넣습니다.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Mission } from '@/types/database'
import { buildSpecialMissionDescription } from '@/lib/specialMissionDescription'
import SpriteImage from '@/components/common/SpriteImage'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
import {
  FINISH_MEAL_ROUTINE_PNG_CSS_FILTER,
  isFinishMealRoutinePngUrl,
  resolveRoutineMissionPngUrl,
  routineMissionIconEmojiForCreate,
} from '@/lib/routineMissionThumbnail'
import {
  SPECIAL_MISSION_CHIPS,
  SPECIAL_MISSION_CHIP_CATEGORIES,
  deriveSpecialMissionSheetState,
  type SpecialMissionSheetBaseline,
} from '@/lib/specialMissionChips'

type Props = {
  open: boolean
  onClose: () => void
  childId: string | null
  specialMissions: Mission[]
  onToast: (msg: string, ok?: boolean) => void
  /** true면 루틴 도우미 패널 안에만 렌더(딤 없음) */
  embedded?: boolean
  /** 저장 성공 시(변경이 있을 때) 기본 토스트 대신 이 문구를 씁니다 */
  successToastOverride?: string
  /** embedded 일 때 손잡이·제목 줄을 숨겨 패널 상단 레이아웃과 겹치지 않게 합니다 */
  embeddedMinimalChrome?: boolean
  /** true면 저장 성공 후 `onClose` 를 호출하지 않아 패널이 열린 채로 유지됩니다 */
  parentHandlesCloseOnSuccess?: boolean
}

/**
 * 스페셜 미션 칩 아이콘
 * - 자녀 앱 카드와 같은 규칙(제목 우선 PNG -> 아틀라스 폴백)으로 렌더링해
 *   부모 앱의 선택 리스트와 자녀 앱 표시 이미지를 일치시킵니다.
 */
function SpecialMissionChipIcon({ title, fallbackEmoji }: { title: string; fallbackEmoji: string }) {
  const png = resolveRoutineMissionPngUrl({ title, iconEmoji: null })
  if (png) {
    /** 「밥 다 먹기」 PNG — 자녀 카드와 같은 필터로 살짝 어둡게 */
    const fix = isFinishMealRoutinePngUrl(png)
      ? ({ filter: FINISH_MEAL_ROUTINE_PNG_CSS_FILTER } as const)
      : undefined
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public 정적 미션 썸네일 직접 표시
      <img src={png} alt="" className="h-6 w-6 object-contain" style={fix} draggable={false} />
    )
  }

  const frame = missionRoutineIconFrame(title, null)
  if (frame) {
    return (
      <SpriteImage
        sheet={MISSION_ROUTINES_ATLAS}
        frame={frame}
        width={24}
        clipRotated={false}
        className="h-6 w-6 select-none object-contain"
      />
    )
  }

  return (
    <span className="text-lg leading-none" aria-hidden>
      {fallbackEmoji}
    </span>
  )
}

export default function SpecialMissionAddSheet({
  open,
  onClose,
  childId,
  specialMissions,
  onToast,
  embedded = false,
  successToastOverride,
  embeddedMinimalChrome = false,
  parentHandlesCloseOnSuccess = false,
}: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dailyAutoIds, setDailyAutoIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const baselineRef = useRef<SpecialMissionSheetBaseline>({})
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    const { selectedIds: s, dailyAutoIds: d, baseline } = deriveSpecialMissionSheetState({
      missions: specialMissions,
      childId,
    })
    baselineRef.current = baseline
    setSelectedIds(s)
    setDailyAutoIds(d)
  }, [open, childId, specialMissions])

  const toggleChip = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setDailyAutoIds((daily) => daily.filter((x) => x !== id))
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }, [])

  const toggleDailyAuto = useCallback((id: string, on: boolean) => {
    setDailyAutoIds((prev) => {
      if (on) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }, [])

  const submit = useCallback(async () => {
    if (!childId) {
      onToast('자녀를 선택해 주세요', false)
      return
    }
    const baseline = baselineRef.current
    if (selectedIds.length === 0 && Object.keys(baseline).length === 0) {
      onToast('특별 미션을 하나 이상 선택해 주세요', false)
      return
    }

    setLoading(true)
    try {
      let created = 0
      let updated = 0
      let deleted = 0

      const fail = async (msg: string) => {
        await router.refresh()
        onToast(msg, false)
      }

      /** 같은 칩에 daily·event 템플릿이 겹쳐 있으면 대표 행만 남기고 나머지는 먼저 지웁니다 */
      for (const entry of Object.values(baseline)) {
        for (const missionId of entry.duplicateMissionIds ?? []) {
          const res = await fetch('/api/mission/delete-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ missionId }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) {
            await fail(typeof json.error === 'string' ? json.error : '중복 미션을 정리하지 못했어요')
            return
          }
          deleted += 1
        }
      }

      for (const chipId of Object.keys(baseline)) {
        if (selectedIds.includes(chipId)) continue
        const missionId = baseline[chipId].missionId
        const res = await fetch('/api/mission/delete-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missionId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          await fail(typeof json.error === 'string' ? json.error : '미션을 지우지 못했어요')
          return
        }
        deleted += 1
      }

      for (const id of selectedIds) {
        const chip = SPECIAL_MISSION_CHIPS.find((c) => c.id === id)
        if (!chip) continue

        const wantDaily = dailyAutoIds.includes(id)
        const base = baseline[id]

        if (base) {
          if (wantDaily !== base.wasDaily) {
            const res = await fetch('/api/mission/patch-repeat-type', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                missionId: base.missionId,
                repeatType: wantDaily ? 'daily' : 'event',
              }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
              await fail(typeof json.error === 'string' ? json.error : '반복 설정을 바꾸지 못했어요')
              return
            }
            updated += 1
          }
          continue
        }

        const desc = buildSpecialMissionDescription(chip.defaultPopupMessage)
        const res = await fetch('/api/mission/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: chip.title,
            description: desc,
            icon_emoji: routineMissionIconEmojiForCreate(chip.title),
            block: 'afternoon',
            scheduled_time: null,
            credit_reward: 15,
            exp_reward: 15,
            heart_reward: 1,
            difficulty: 'special',
            repeat_type: wantDaily ? 'daily' : 'event',
            level_required: 0,
            linked_child_id: childId,
          }),
        })
        const json = await res.json().catch(() => ({}))
        const missionRow = json.mission as { id?: string } | undefined
        const newId = typeof missionRow?.id === 'string' ? missionRow.id : ''
        if (!res.ok || !newId) {
          await fail(typeof json.error === 'string' ? json.error : '만들지 못했어요')
          return
        }
        created += 1
      }

      await router.refresh()

      const parts: string[] = []
      if (created > 0) parts.push(`새로 ${created}개`)
      if (updated > 0) parts.push(`설정 변경 ${updated}개`)
      if (deleted > 0) parts.push(`삭제 ${deleted}개`)
      if (parts.length > 0) {
        onToast(successToastOverride ?? `스페셜 미션: ${parts.join(', ')} 반영했어요.`)
      } else {
        onToast('변경할 내용이 없어요')
      }
      if (!parentHandlesCloseOnSuccess) onClose()
    } catch {
      onToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(false)
    }
  }, [childId, selectedIds, dailyAutoIds, router, onToast, onClose, successToastOverride, parentHandlesCloseOnSuccess])

  if (!open) return null

  const selectedChips = [...new Set(selectedIds)]
    .map((id) => SPECIAL_MISSION_CHIPS.find((c) => c.id === id))
    .filter((c): c is (typeof SPECIAL_MISSION_CHIPS)[number] => Boolean(c))

  const dailyChips = selectedChips.filter((c) => dailyAutoIds.includes(c.id))
  const eventChips = selectedChips.filter((c) => !dailyAutoIds.includes(c.id))
  const chipById = new Map(SPECIAL_MISSION_CHIPS.map((chip) => [chip.id, chip]))

  const card = (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden bg-white shadow-2xl ${
        embedded ? 'h-full max-h-full rounded-xl border border-gray-100' : 'max-h-[88vh] w-full rounded-t-2xl'
      }`}
    >
        {embedded && embeddedMinimalChrome ? (
          <div className="sr-only" id="sp-sheet-title">
            스페셜 미션
          </div>
        ) : (
          <>
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
            <div className="border-b border-gray-100 px-4 pb-2 pt-3">
              <p id="sp-sheet-title" className="text-center text-sm font-black text-gray-900">
                스페셜 미션
              </p>
            </div>
          </>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3 pt-2">
          <div className="rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
            <p className="mb-1.5 text-xs font-black text-gray-900">이벤트 미션 키워드</p>
            <div className="space-y-2">
              {SPECIAL_MISSION_CHIP_CATEGORIES.map((category) => {
                const chips = category.chipIds
                  .map((chipId) => chipById.get(chipId))
                  .filter((chip): chip is (typeof SPECIAL_MISSION_CHIPS)[number] => Boolean(chip))
                if (chips.length === 0) return null
                return (
                  <section key={category.id} className="space-y-1">
                    <p className="text-[11px] font-black text-gray-500">{category.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((chip) => {
                        const selected = selectedIds.includes(chip.id)
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => toggleChip(chip.id)}
                            className={[
                              'rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all',
                              selected
                                ? 'border-violet-500 bg-violet-50 text-violet-800'
                                : 'border-gray-200 text-gray-400',
                            ].join(' ')}
                          >
                            {chip.title}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              {/* 카테고리에 없는 칩이 생겨도 숨지 않도록 마지막에 기타로 노출 */}
              {SPECIAL_MISSION_CHIPS.some(
                (chip) => !SPECIAL_MISSION_CHIP_CATEGORIES.some((category) => category.chipIds.includes(chip.id)),
              ) ? (
                <section className="space-y-1">
                  <p className="text-[11px] font-black text-gray-500">기타</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SPECIAL_MISSION_CHIPS.filter(
                      (chip) => !SPECIAL_MISSION_CHIP_CATEGORIES.some((category) => category.chipIds.includes(chip.id)),
                    ).map((chip) => {
                      const selected = selectedIds.includes(chip.id)
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => toggleChip(chip.id)}
                          className={[
                            'rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all',
                            selected
                              ? 'border-violet-500 bg-violet-50 text-violet-800'
                              : 'border-gray-200 text-gray-400',
                          ].join(' ')}
                        >
                          {chip.title}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {selectedChips.length > 0 ? (
            <div className="space-y-3">
              {dailyChips.length > 0 ? (
                <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                  <p className="text-xs font-black text-violet-900">매일 일정에 표시</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-violet-800/80">
                    매일 스페셜 미션으로 자동으로 추가됩니다.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {dailyChips.map((chip) => (
                      <li
                        key={chip.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/90 px-2.5 py-2 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <SpecialMissionChipIcon title={chip.title} fallbackEmoji={chip.emoji} />
                          <span className="min-w-0 text-[11px] font-bold text-gray-800">{chip.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDailyAuto(chip.id, false)}
                          className="shrink-0 text-[9px] font-bold text-violet-600 underline-offset-2 hover:underline"
                        >
                          매일 해제
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {eventChips.length > 0 ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                  <p className="text-xs font-black text-amber-900">오늘 하루만 일정에 추가</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-amber-900/70">
                    오늘 하루만 스페셜 미션에 추가할 수 있어요.
                    
                  </p>
                  <ul className="mt-2 space-y-2">
                    {eventChips.map((chip) => (
                      <li
                        key={chip.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/90 px-2.5 py-2 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <SpecialMissionChipIcon title={chip.title} fallbackEmoji={chip.emoji} />
                          <span className="min-w-0 text-[11px] font-bold text-gray-800">{chip.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDailyAuto(chip.id, true)}
                          className="shrink-0 text-[9px] font-bold text-amber-800 underline-offset-2 hover:underline"
                        >
                          매일로 바꾸기
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
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
            disabled={loading}
            onClick={() => void submit()}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {loading ? '처리 중…' : '저장하기'}
          </button>
        </div>
      </div>
  )

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" role="region" aria-labelledby="sp-sheet-title">
        {card}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[72] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="sp-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      {card}
    </div>
  )
}
