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
import ParentFeatureHowToCard from '@/components/parent/ParentFeatureHowToCard'
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

  const enqueueLevelUp = useCallback(
    (payload: LevelUpModalPayload) => {
      const lastNotified = readParentLastNotifiedLevel(payload.childId)
      if (payload.newLevel <= lastNotified) return

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

  function closeModal() {
    if (modal.open) {
      writeParentLastNotifiedLevel(modal.childId, modal.newLevel)
      levelByChildRef.current.set(modal.childId, modal.newLevel)
    }
    showNextFromQueue()
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
      onClick={closeModal}
    >
      <div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col px-6 py-5">
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
              <p className="mt-1 text-center text-[11px] leading-relaxed text-gray-500">
                아이는 아직 글을 읽기 어려워요.
                <br />
                아래 순서를 보면서 아이와 함께 한 번 해 보세요.
              </p>
              <ul className="mt-3 space-y-2.5">
                {modal.unlocks.map((u) => (
                  <li key={u.id}>
                    <ParentFeatureHowToCard feature={u} highlight />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-row gap-2 border-t border-gray-100 px-5 py-4">
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
  )
}
