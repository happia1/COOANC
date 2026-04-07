'use client'

/**
 * 스페셜 미션 보상 배율(1·2·3배)을 고르는 하단 시트입니다.
 * - 부모가 「일정 추가」를 누른 뒤(오늘 하루만 미션) 또는 「보상 배율」을 눌렀을 때(매일 스페셜) 열립니다.
 * - 저장하면 DB `missions.reward_multiplier` 가 갱신되고, 자녀가 미션을 완료할 때 그만큼 보상이 곱해집니다.
 * - document.body 로 포털해 루틴 탭 스크롤 밖에서도 전체 화면을 덮습니다.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Mission } from '@/types/database'
import { displaySpecialMissionTitle } from '@/lib/specialMissionChips'
import { normalizeRewardMultiplier, type RewardMultiplier } from '@/lib/missionRewardMultiplier'

type Props = {
  mission: Mission | null
  onClose: () => void
  /** 저장 성공 시 갱신된 미션 행으로 부모 목록을 merge */
  onSaved: (m: Mission) => void
  showToast: (msg: string, ok?: boolean) => void
}

const OPTIONS: { mult: RewardMultiplier; label: string; hint: string }[] = [
  { mult: 1, label: '기본 (1배)', hint: '템플릿에 적힌 보상 그대로' },
  { mult: 2, label: '2배', hint: '크레딧·하트·EXP 모두 2배' },
  { mult: 3, label: '3배', hint: '크레딧·하트·EXP 모두 3배' },
]

export default function SpecialMissionBonusSheet({ mission, onClose, onSaved, showToast }: Props) {
  const [portalReady, setPortalReady] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)
  const [pick, setPick] = useState<RewardMultiplier>(1)
  const [saving, setSaving] = useState(false)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!mission) {
      setSheetEntered(false)
      return
    }
    setPick(normalizeRewardMultiplier(mission.reward_multiplier))
    setSheetEntered(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [mission])

  async function save() {
    if (!mission) return
    setSaving(true)
    try {
      const res = await fetch('/api/mission/patch-reward-multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId: mission.id, reward_multiplier: pick }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.mission) {
        showToast(typeof json.error === 'string' ? json.error : '저장에 실패했어요', false)
        return
      }
      onSaved(json.mission as Mission)
      onClose()
      showToast('보너스 설정을 저장했어요')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setSaving(false)
    }
  }

  if (!mission) return null

  const titleShort = displaySpecialMissionTitle(mission.title)
  const overlay = (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="bonus-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className={`pointer-events-auto flex max-h-[min(88dvh,100vh-1rem)] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
            sheetEntered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
          <div className="shrink-0 border-b border-gray-100 px-4 py-3">
            <h2 id="bonus-sheet-title" className="text-center text-sm font-black text-gray-900">
              보너스 보상
            </h2>
            <p className="mt-0.5 text-center text-xs font-bold text-gray-600">{titleShort}</p>
            <p className="mt-2 text-center text-[11px] leading-snug text-gray-500">
              자녀가 이 미션을 완료하면 크레딧·하트·EXP가 아래 배율만큼 곱해져 지급돼요.
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-2 pt-3">
            {OPTIONS.map((o) => {
              const on = pick === o.mult
              return (
                <button
                  key={o.mult}
                  type="button"
                  onClick={() => setPick(o.mult)}
                  className={`flex w-full flex-col items-start rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                    on ? 'border-[#4A90E2] bg-blue-50/80' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-black text-gray-900">{o.label}</span>
                  <span className="text-[10px] text-gray-500">{o.hint}</span>
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600"
            >
              취소
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(overlay, document.body)
}
