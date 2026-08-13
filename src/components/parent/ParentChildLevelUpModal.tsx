'use client'

/**
 * 부모 앱 전역: 자녀 `child_stats.current_level` 이 오르면 축하 팝업 + 새로 열린 기능 아이콘 안내
 *
 * - Realtime UPDATE(`child_stats`) + 앱 진입 시 놓친 레벨업(localStorage 비교)을 함께 처리합니다.
 * - 구매 요청 팝업(`ParentNewPurchaseRequestModal`)과 같은 껍데기 스타일을 씁니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCachedParentChildIds } from '@/lib/browserParentAuthCache'
import type { ChildBadgeEntry, ChildZone } from '@/constants/childGrowthLevels'
import {
  getChildBadge,
  getChildZone,
  getParentGuide,
  readParentLastNotifiedLevel,
  unlocksNewlyOpenedBetweenLevels,
  writeParentLastNotifiedLevel,
  type ParentChildUnlockMilestone,
} from '@/lib/parentChildLevelUnlocks'
import { useParentStore } from '@/store/parentStore'
import { openNoticeCenter } from '@/lib/noticeCenterBus'
import {
  acknowledgeParentOnboarding,
  readParentOnboardingAck,
  PARENT_ONBOARDING_LEVEL_UP_POPUP,
} from '@/lib/parentOnboardingAck'
import {
  PARENT_POPUP_BTN,
  PARENT_POPUP_OVERLAY,
} from '@/lib/parentPopupCardStyles'

type LevelUpModalPayload = {
  childId: string
  childName: string
  newLevel: number
  previousLevel: number
  zone: ChildZone
  badge: ChildBadgeEntry | null
  parentGuide: string | null
  unlocks: ParentChildUnlockMilestone[]
}

type ModalState = { open: false } | ({ open: true } & LevelUpModalPayload)

export default function ParentChildLevelUpModal() {
  const router = useRouter()
  const setSelectedChildId = useParentStore((s) => s.setSelectedChildId)
  const [modal, setModal] = useState<ModalState>({ open: false })
  /** 「다시 보지 않기」 체크 상태 — 닫을 때 한 번만 저장합니다 */
  const [dontShowAgain, setDontShowAgain] = useState(false)
  /** 이미 「다시 보지 않기」를 켜 둔 부모에게는 아예 띄우지 않습니다 */
  const optedOutRef = useRef(false)
  /**
   * 옵트아웃 조회가 끝났는지. 끝나기 전에는 팝업을 띄우지 않고 대기열에만 넣습니다.
   * (조회가 늦으면 이미 끈 부모에게도 팝업이 한 번 뜨던 문제를 막습니다.)
   */
  const optOutResolvedRef = useRef(false)
  const queueRef = useRef<LevelUpModalPayload[]>([])
  const levelByChildRef = useRef<Map<string, number>>(new Map())
  const nameByChildRef = useRef<Map<string, string>>(new Map())
  const bootstrapDoneRef = useRef(false)

  const showNextFromQueue = useCallback(() => {
    const next = queueRef.current.shift()
    if (next) {
      writeParentLastNotifiedLevel(next.childId, next.newLevel)
      levelByChildRef.current.set(next.childId, next.newLevel)
      setModal({ open: true, ...next })
    } else {
      setModal({ open: false })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void readParentOnboardingAck(PARENT_ONBOARDING_LEVEL_UP_POPUP).then((acked) => {
      if (cancelled) return
      /** `null`(알 수 없음)은 끈 것으로 보지 않습니다 — 일시적 오류로 영영 안 뜨면 되돌릴 길이 없습니다 */
      optedOutRef.current = acked === true
      optOutResolvedRef.current = true

      if (optedOutRef.current) {
        /** 조회를 기다리며 쌓아 둔 것들은 레벨만 기록하고 접습니다 */
        for (const p of queueRef.current) {
          writeParentLastNotifiedLevel(p.childId, p.newLevel)
          levelByChildRef.current.set(p.childId, p.newLevel)
        }
        queueRef.current = []
        return
      }
      showNextFromQueue()
    })
    return () => {
      cancelled = true
    }
  }, [showNextFromQueue])

  const enqueueLevelUp = useCallback(
    (payload: LevelUpModalPayload) => {
      const lastNotified = readParentLastNotifiedLevel(payload.childId)
      if (payload.newLevel <= lastNotified) return

      /**
       * 「다시 보지 않기」를 켜 둔 부모에게는 팝업을 띄우지 않습니다.
       * 레벨 기록만 남겨 두어 나중에 밀린 팝업이 한꺼번에 뜨지 않게 합니다.
       */
      if (optedOutRef.current) {
        writeParentLastNotifiedLevel(payload.childId, payload.newLevel)
        levelByChildRef.current.set(payload.childId, payload.newLevel)
        return
      }

      /** 옵트아웃 조회가 아직 안 끝났으면 띄우지 않고 대기열에만 넣습니다 */
      if (!optOutResolvedRef.current) {
        levelByChildRef.current.set(payload.childId, payload.newLevel)
        queueRef.current.push(payload)
        return
      }

      levelByChildRef.current.set(payload.childId, payload.newLevel)

      const isShowing = modal.open
      if (!isShowing) {
        writeParentLastNotifiedLevel(payload.childId, payload.newLevel)
        setModal({ open: true, ...payload })
        return
      }

      queueRef.current.push(payload)
    },
    [modal.open],
  )

  const handleLevelIncrease = useCallback(
    (childId: string, prevLevel: number, newLevel: number) => {
      if (newLevel <= prevLevel) return
      const childName = nameByChildRef.current.get(childId) ?? '우리 아이'
      enqueueLevelUp({
        childId,
        childName,
        newLevel,
        previousLevel: prevLevel,
        zone: getChildZone(newLevel),
        badge: getChildBadge(newLevel),
        parentGuide: getParentGuide(newLevel),
        unlocks: unlocksNewlyOpenedBetweenLevels(prevLevel, newLevel),
      })
    },
    [enqueueLevelUp],
  )

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    const childIdSet = new Set<string>()

    async function bootstrap() {
      const childIds = await getCachedParentChildIds(supabase)
      if (cancelled || childIds.length === 0) return
      childIds.forEach((id) => childIdSet.add(id))

      const [{ data: statsRows }, { data: profileRows }] = await Promise.all([
        supabase.from('child_stats').select('child_id, current_level').in('child_id', childIds),
        supabase.from('profiles').select('id, name').in('id', childIds),
      ])

      for (const row of profileRows ?? []) {
        const cid = row.id as string
        const name = typeof row.name === 'string' ? row.name.trim() : ''
        if (name) nameByChildRef.current.set(cid, name)
      }

      for (const row of statsRows ?? []) {
        const cid = row.child_id as string
        const lv = typeof row.current_level === 'number' ? row.current_level : 0
        levelByChildRef.current.set(cid, lv)

        if (!bootstrapDoneRef.current) {
          const lastNotified = readParentLastNotifiedLevel(cid)
          if (lv > lastNotified) {
            handleLevelIncrease(cid, lastNotified, lv)
          }
        }
      }

      bootstrapDoneRef.current = true

      channel = supabase
        .channel(`parent-child-level-up-${childIds.join('-')}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'child_stats' },
          (payload) => {
            const row = payload.new as { child_id?: string; current_level?: number }
            if (!row.child_id || !childIdSet.has(row.child_id)) return
            const next =
              typeof row.current_level === 'number' ? row.current_level : levelByChildRef.current.get(row.child_id) ?? 0
            const prev = levelByChildRef.current.get(row.child_id) ?? next
            if (next > prev) {
              handleLevelIncrease(row.child_id, prev, next)
            } else {
              levelByChildRef.current.set(row.child_id, next)
            }
          },
        )
        .subscribe()
    }

    void bootstrap()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [handleLevelIncrease])

  /** 이 팝업만 접고 다음 대기 팝업으로 — 「다시 보지 않기」는 반영하지 않습니다 */
  function dismissModal() {
    if (modal.open) {
      writeParentLastNotifiedLevel(modal.childId, modal.newLevel)
      levelByChildRef.current.set(modal.childId, modal.newLevel)
    }
    showNextFromQueue()
  }

  /**
   * 버튼으로 닫을 때 — 체크했으면 「다시 보지 않기」를 확정합니다.
   *
   * 배경(딤) 클릭은 이 함수를 쓰지 않습니다.
   * 되돌릴 수 없는 설정을 실수로 확정해 버리면 곤란하기 때문입니다.
   */
  function closeModal() {
    if (!dontShowAgain) {
      dismissModal()
      return
    }

    optedOutRef.current = true
    void acknowledgeParentOnboarding(PARENT_ONBOARDING_LEVEL_UP_POPUP)

    /** 지금 것과 대기 중인 것 모두 레벨을 기록해 두어, 저장이 실패해도 다시 몰려 뜨지 않게 합니다 */
    if (modal.open) {
      writeParentLastNotifiedLevel(modal.childId, modal.newLevel)
      levelByChildRef.current.set(modal.childId, modal.newLevel)
    }
    for (const p of queueRef.current) {
      writeParentLastNotifiedLevel(p.childId, p.newLevel)
      levelByChildRef.current.set(p.childId, p.newLevel)
    }
    queueRef.current = []
    setModal({ open: false })
  }

  /** 알림창으로 넘어갈 때 — 다음 팝업이 그 위를 덮지 않도록 대기열을 비웁니다 */
  function closeAllAndOpenNoticeCenter() {
    if (modal.open) {
      writeParentLastNotifiedLevel(modal.childId, modal.newLevel)
      levelByChildRef.current.set(modal.childId, modal.newLevel)
    }
    for (const p of queueRef.current) {
      writeParentLastNotifiedLevel(p.childId, p.newLevel)
      levelByChildRef.current.set(p.childId, p.newLevel)
    }
    queueRef.current = []
    setModal({ open: false })
    openNoticeCenter()
  }

  function handleViewChildHome() {
    if (!modal.open) return
    setSelectedChildId(modal.childId)
    closeModal()
    router.push('/parent/child-entry')
  }

  if (!modal.open) return null

  const hasUnlocks = modal.unlocks.length > 0
  const hasParentGuide = Boolean(modal.parentGuide?.trim())

  return (
    <div
      className={`${PARENT_POPUP_OVERLAY} z-[200] bg-black/45`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-child-level-up-title"
      onClick={dismissModal}
    >
      {/**
        * 최대 높이를 화면의 85% 로 묶고 본문만 스크롤합니다.
        * 예전에는 높이 제한이 없어 내용이 길면 아래 버튼이 화면 밖으로 밀려
        * 팝업을 닫지 못하는 일이 있었습니다. 버튼 줄은 항상 보이게 고정합니다.
        */}
      <div
        className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="text-center text-3xl leading-none" aria-hidden>
            🎉
          </p>
          <p className="mt-2 text-center text-sm font-bold text-gray-600">
            {modal.childName}님이 레벨업했어요!
          </p>

          <div className="mt-3 text-center">
            <p
              id="parent-child-level-up-title"
              className="text-3xl font-black tabular-nums leading-none text-brand-text"
            >
              Lv.{modal.newLevel}
            </p>
            <p className="mt-2 text-base font-bold text-sky-800">
              {modal.zone.emoji} {modal.zone.zone}
            </p>
            {modal.badge ? (
              <p className="mt-1 text-sm font-bold text-amber-800">🏅 {modal.badge.badge}</p>
            ) : null}
          </div>

          {hasParentGuide ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700">💡 이 단계 부모 가이드</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {modal.parentGuide}
              </p>
            </div>
          ) : null}

          {hasUnlocks ? (
            <>
              {/**
                * 새로 열린 기능의 「사용 순서」를 부모 화면에 한 페이지로 펼칩니다.
                * 아이는 글을 못 읽을 수 있어 자녀 앱에는 짧은 안내만 두고,
                * 실제 사용법은 여기서 부모가 보고 아이와 함께 해 보도록 했습니다.
                */}
              <p className="mt-4 text-center text-xs font-bold text-gray-600">
                아이 화면에 새로 열린 기능
              </p>
              {/**
                * 여기서는 「무엇이 열렸는지」만 짧게 보여 줍니다.
                * 사용 순서까지 펼치면 팝업이 화면을 넘어가 버려서,
                * 자세한 내용은 아래 「자세히 알아보기」로 상단 알림창에 넘깁니다.
                */}
              <ul className="mt-2 space-y-1.5">
                {modal.unlocks.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 rounded-xl bg-sky-50/90 px-3 py-2 ring-1 ring-sky-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.iconSrc} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-800">{u.title}</p>
                      <p className="truncate text-[11px] leading-relaxed text-gray-600">{u.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={closeAllAndOpenNoticeCenter}
                className="mt-2.5 w-full rounded-xl border border-sky-200 bg-white py-2 text-[11px] font-bold text-[#2563EB] transition active:scale-[0.98]"
              >
                사용 순서 자세히 알아보기 →
              </button>
            </>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-3">
          {/* 다시 보지 않기 — 체크하면 이후 레벨업에도 이 팝업이 뜨지 않습니다 */}
          <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-[11px] font-medium text-gray-500">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 accent-[#4A90E2]"
            />
            이 안내 다시 보지 않기
          </label>
          <div className="flex flex-row gap-2">
          <button
            type="button"
            onClick={closeModal}
            className={`${PARENT_POPUP_BTN} border border-gray-200 bg-white text-gray-500`}
          >
            확인
          </button>
          <button
            type="button"
            onClick={handleViewChildHome}
            className={`${PARENT_POPUP_BTN} bg-brand-blue text-white shadow-md`}
          >
            자녀 화면 보기
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
