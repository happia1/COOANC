'use client'

/**
 * 부모 앱 — 승인 탭
 * - 상단은 루틴 탭과 같은 자녀 프로필 카드 + 다자녀 전환(스토어 selectedChildId 공유).
 * - 구매 요청·미션 롤백은 선택 중인 자녀 기준으로만 표시합니다.
 * - 미션 롤백 아래: 자녀 마켓 메뉴 제어(상품 표시/숨김, 가족 전용 상품 추가).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import ParentMarketMenuControl from '@/components/parent/ParentMarketMenuControl'
import type { PurchaseRequest, StoreItem } from '@/types/database'

const REJECT_PRESETS = [
  '아직은 너무 일러요',
  '다음 기회에 사자',
  '다른 걸 먼저 모아봐',
  '엄마·아빠랑 같이 가서 고르자',
]

type MissionLog = {
  id: string
  child_id: string
  assigned_date: string
  completed_at: string | null
  credit_earned: number
  heart_earned: number
  exp_earned: number
  missions: { title: string; icon_emoji: string } | null
}

/** 루틴 탭과 동일한 자녀 한 명 분 */
export type ApprovalChildProfile = {
  id: string
  name: string
  level: number
  credits: number
  hearts: number
  streakDays: number
  age: number | null
  avatarUrl: string | null
  institutionType: string | null
  ageGroupLabel: string
  childcareLabel: string | null
}

type Props = {
  childrenProfiles: ApprovalChildProfile[]
  pendingRequests: PurchaseRequest[]
  recentLogs: MissionLog[]
  /** 부모에게 보이는 활성 상품(전체 + 가족 전용) */
  storeItems: StoreItem[]
  /** child_id → family_links.id */
  linkByChild: Record<string, string>
  /** 숨김 행: 자녀별로 가려진 상품 id */
  hiddenItemIdsByChild: Record<string, string[]>
}

export default function ApprovalTab({
  childrenProfiles,
  pendingRequests,
  recentLogs,
  storeItems: initialStoreItems,
  linkByChild,
  hiddenItemIdsByChild: initialHidden,
}: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()

  const [requests, setRequests] = useState<PurchaseRequest[]>(pendingRequests)
  const [logs, setLogs] = useState<MissionLog[]>(recentLogs)
  const [storeItems, setStoreItems] = useState<StoreItem[]>(initialStoreItems)

  const [hiddenByChild, setHiddenByChild] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {}
    for (const c of childrenProfiles) {
      const ids = initialHidden[c.id] ?? []
      m[c.id] = new Set<string>(ids)
    }
    return m
  })

  const [rejectModal, setRejectModal] = useState<{ requestId: string; itemName: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rollbackModal, setRollbackModal] = useState<{ logId: string; title: string } | null>(null)

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    if (childrenProfiles.length === 0) {
      setSelectedChildId(null)
      return
    }
    const stillThere = selectedChildId && childrenProfiles.some((c) => c.id === selectedChildId)
    if (!stillThere) {
      setSelectedChildId(childrenProfiles[0].id)
    }
  }, [childrenProfiles, selectedChildId, setSelectedChildId])

  const currentId = selectedChildId ?? childrenProfiles[0]?.id ?? null
  const currentChild = childrenProfiles.find((c) => c.id === currentId) ?? childrenProfiles[0]
  const childLevel = currentChild?.level ?? 0

  const tabs: ChildTab[] = useMemo(
    () => childrenProfiles.map((c) => ({ id: c.id, name: c.name })),
    [childrenProfiles],
  )

  const requestsForChild = useMemo(
    () => (currentId ? requests.filter((r) => r.child_id === currentId) : []),
    [requests, currentId],
  )

  const logsForChild = useMemo(
    () => (currentId ? logs.filter((l) => l.child_id === currentId) : []),
    [logs, currentId],
  )

  const hiddenSetForCurrent = useMemo((): Set<string> => {
    if (!currentId) return new Set()
    return hiddenByChild[currentId] ?? new Set()
  }, [hiddenByChild, currentId])

  const onHiddenChangeForCurrent = useCallback(
    (next: Set<string>) => {
      if (!currentId) return
      setHiddenByChild((prev) => ({ ...prev, [currentId]: next }))
    },
    [currentId],
  )

  async function handleApprove(requestId: string) {
    setLoading(requestId)
    try {
      const res = await fetch('/api/market/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve' }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요', false)
        return
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      showToast('승인했어요. 자녀에게 전달됩니다.')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    if (!rejectModal) return
    setLoading(rejectModal.requestId)
    try {
      const res = await fetch('/api/market/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: rejectModal.requestId,
          action: 'reject',
          parentNote: rejectNote || null,
        }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요', false)
        return
      }
      setRequests((prev) => prev.filter((r) => r.id !== rejectModal.requestId))
      setRejectModal(null)
      setRejectNote('')
      showToast('반려 처리했어요.')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  async function handleRollback() {
    if (!rollbackModal) return
    setLoading(rollbackModal.logId)
    try {
      const res = await fetch('/api/mission/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionLogId: rollbackModal.logId }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요', false)
        return
      }
      setLogs((prev) => prev.filter((l) => l.id !== rollbackModal.logId))
      setRollbackModal(null)
      showToast('미션을 미완료 상태로 되돌렸어요.')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${
            toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl">
            <p className="font-black text-brand-text text-base mb-1">반려 사유 선택</p>
            <p className="text-xs text-gray-400 mb-4">{rejectModal.itemName}</p>

            <div className="flex flex-col gap-2 mb-4">
              {REJECT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRejectNote(preset)}
                  className={`text-left text-sm px-4 py-2.5 rounded-xl border transition-all ${
                    rejectNote === preset
                      ? 'border-brand-blue bg-brand-blue/10 font-bold text-brand-blue'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="직접 입력하기"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 mb-4"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null)
                  setRejectNote('')
                }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!!loading}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold shadow-md active:scale-95 disabled:opacity-50"
              >
                반려하기
              </button>
            </div>
          </div>
        </div>
      )}

      {rollbackModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center">
            <p className="font-black text-brand-text text-base mb-2">미션을 미완료로 되돌릴까요?</p>
            <p className="text-sm text-gray-400 mb-1">
              <span className="font-bold text-brand-text">{rollbackModal.title}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">획득한 크레딧·하트·EXP가 회수됩니다.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRollbackModal(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleRollback}
                disabled={!!loading}
                className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-bold shadow-md active:scale-95 disabled:opacity-50"
              >
                롤백하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 루틴 탭과 동일: 프로필 카드 + 다자녀 화살표 */}
      {currentChild && (
        <div className="flex flex-col gap-2">
          <CompactChildProfileCard
            name={currentChild.name}
            age={currentChild.age}
            avatarUrl={currentChild.avatarUrl}
            level={childLevel}
            credits={currentChild.credits}
            hearts={currentChild.hearts}
            streakDays={currentChild.streakDays}
            ageGroupLabel={currentChild.ageGroupLabel}
            childcareLabel={currentChild.childcareLabel}
            mission={null}
          />
          <ChildProfileNav tabs={tabs} compact />
        </div>
      )}

      {/* 구매 요청 — 선택 자녀만 */}
      <section>
        <h2 className="text-sm font-bold text-brand-text mb-1">구매 요청</h2>
        <p className="mb-2 text-[10px] leading-snug text-gray-400">
          자녀가 스스로 얻은 크레딧으로 고른 보상을 승인해주세요.
        </p>

        {requestsForChild.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">대기 중인 구매 요청이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requestsForChild.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-400">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-text">{req.item_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{req.requested_at.slice(0, 10)}</p>
                    {req.child_message && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1 mt-2 italic">
                        &ldquo;{req.child_message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-brand-blue text-lg tabular-nums">
                      {req.item_price.toLocaleString()} 크레딧
                    </p>
                    <p className="text-[10px] text-gray-400">{req.item_type === 'digital' ? '디지털' : '실물'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectModal({ requestId: req.id, itemName: req.item_name })}
                    disabled={loading === req.id}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    반려
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(req.id)}
                    disabled={loading === req.id}
                    className="flex-1 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading === req.id ? '처리 중...' : '승인'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 미션 롤백 — 선택 자녀만 */}
      <section>
        <h2 className="text-sm font-bold text-brand-text mb-2">미션 롤백</h2>
        <p className="text-xs text-gray-400 mb-2">완료된 미션이 실제로 수행되지 않았다면 되돌릴 수 있어요</p>

        {logsForChild.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">최근 완료 미션이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {logsForChild.map((log) => (
              <div key={log.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-text truncate">{log.missions?.title ?? '미션'}</p>
                  <p className="text-xs text-gray-400">{log.completed_at?.slice(0, 10)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-brand-blue tabular-nums">+{log.credit_earned} 크레딧</p>
                  <button
                    type="button"
                    onClick={() => setRollbackModal({ logId: log.id, title: log.missions?.title ?? '미션' })}
                    disabled={loading === log.id}
                    className="text-[10px] text-orange-500 font-bold mt-0.5 hover:underline disabled:opacity-50"
                  >
                    롤백
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ParentMarketMenuControl
        childId={currentId}
        storeItems={storeItems}
        hiddenItemIds={hiddenSetForCurrent}
        familyLinkIdForChild={currentId ? linkByChild[currentId] ?? null : null}
        onHiddenChange={onHiddenChangeForCurrent}
        onItemCreated={(item) => setStoreItems((prev) => [...prev, item])}
      />
    </div>
  )
}
