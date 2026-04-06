'use client'

/**
 * 부모 앱 — 승인 탭
 * - 상단은 루틴 탭과 같은 자녀 프로필 카드 + 다자녀 전환(스토어 selectedChildId 공유).
 * - 구매 요청·미션 롤백은 선택 중인 자녀 기준으로만 표시합니다.
 * - 미션 롤백: 카드 탭 시 하단 시트(스크롤, 10건까지 + 더보기). 자녀 완료 시 브로드캐스트+postgres_changes 로 목록 즉시 갱신.
 * - 미션 롤백 아래: 자녀 마켓 메뉴 제어(상품 표시/숨김, 가족 전용 상품 추가).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import ParentMarketMenuControl from '@/components/parent/ParentMarketMenuControl'
import PraiseStickerPanel from '@/components/parent/PraiseStickerPanel'
import type { PurchaseRequest, StoreItem } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import SpriteImage from '@/components/common/SpriteImage'
import { MARKET_ITEMS } from '@/constants/sprites'
import { marketFrameKeyForItemId } from '@/lib/marketItemFrame'
import { getSeoulDateString } from '@/lib/koreaDate'

/** mission_logs 조회 시 부모 탭 목록과 동일한 필드(실시간 갱신용) */
const MISSION_LOG_SELECT_FOR_LIST =
  'id, child_id, assigned_date, completed_at, credit_earned, heart_earned, exp_earned, missions(title, icon_emoji)'

/** 미션 롤백 시트에서 먼저 보여 줄 개수 — 그 이상은 「더보기」 */
const ROLLBACK_SHEET_INITIAL = 10

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

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [rollbackSheetOpen, setRollbackSheetOpen] = useState(false)
  const [rollbackSheetShowAll, setRollbackSheetShowAll] = useState(false)

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

  /** 서울 기준 오늘 배정일(assigned_date)인 완료 로그만 — 롤백(다시하기) 대상 */
  const todayCompletedLogs = useMemo(() => {
    const todaySeoul = getSeoulDateString()
    return logsForChild.filter((l) => l.assigned_date === todaySeoul && l.completed_at)
  }, [logsForChild])

  /** 선택 자녀의 완료 로그 20건을 다시 가져와 state 에 합칩니다(다른 자녀 행은 유지) */
  const refreshChildMissionLogs = useCallback(async () => {
    if (!currentId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mission_logs')
      .select(MISSION_LOG_SELECT_FOR_LIST)
      .eq('child_id', currentId)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(20)
    if (error || !data) return
    setLogs((prev) => {
      const rest = prev.filter((l) => l.child_id !== currentId)
      return [...(data as unknown as MissionLog[]), ...rest]
    })
  }, [currentId])

  const visibleRollbackInSheet = useMemo(() => {
    if (rollbackSheetShowAll) return todayCompletedLogs
    return todayCompletedLogs.slice(0, ROLLBACK_SHEET_INITIAL)
  }, [todayCompletedLogs, rollbackSheetShowAll])

  /** postgres_changes + 자녀 완료 브로드캐스트 둘 다 같은 재조회로 반영합니다 */
  useEffect(() => {
    if (!currentId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`approval_mission_logs:${currentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mission_logs',
          filter: `child_id=eq.${currentId}`,
        },
        () => {
          void refreshChildMissionLogs()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentId, refreshChildMissionLogs])

  /** 자녀 미션 완료 직후 MissionTab 이 보내는 브로드캐스트 — Realtime 보다 빨리 목록을 맞출 수 있음 */
  useEffect(() => {
    if (!currentId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`parent_mission_log_refresh:${currentId}`)
      .on('broadcast', { event: 'child_completed_mission' }, () => {
        void refreshChildMissionLogs()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentId, refreshChildMissionLogs])

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

  /** 승인 / 바로 구매 둘 다 서버에서는 같은 「승인」처리 — 안내 문구만 다릅니다 */
  async function handleApprove(requestId: string, mode: 'approve' | 'instant' = 'approve') {
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
      showToast(
        mode === 'instant'
          ? '바로 구매로 확정했어요. 자녀에게 배달이 시작됐다고 알려줘요.'
          : '승인했어요. 자녀에게 전달됩니다.',
      )
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

  /**
   * 「다시하기」: 서버 API 대신 Realtime 브로드캐스트로 자녀 앱에만 팝업을 띄웁니다.
   * 실제 DB 롤백은 자녀가 팝업에서 확인할 때 MissionTab 에서 처리합니다.
   */
  async function handleRequestRedoFromChild(log: MissionLog) {
    if (!currentId) return
    setLoading(log.id)
    try {
      const supabase = createClient()
      const { data: row, error: rowErr } = await supabase
        .from('mission_logs')
        .select('mission_id, assigned_date, child_id, is_completed')
        .eq('id', log.id)
        .maybeSingle()
      if (rowErr || !row?.is_completed) {
        showToast(rowErr?.message ?? '이미 처리됐거나 찾을 수 없어요', false)
        return
      }
      const { data: dm, error: dmErr } = await supabase
        .from('daily_missions')
        .select('id')
        .eq('child_id', row.child_id)
        .eq('mission_template_id', row.mission_id)
        .eq('date', row.assigned_date)
        .maybeSingle()
      if (dmErr || !dm) {
        showToast('오늘의 미션 카드와 연결할 수 없어요', false)
        return
      }

      const channelName = `mission_redo:${currentId}`
      const channel = supabase.channel(channelName, { config: { broadcast: { ack: false } } })

      await new Promise<void>((resolve, reject) => {
        let settled = false
        const timeout = window.setTimeout(() => {
          if (settled) return
          settled = true
          void supabase.removeChannel(channel)
          reject(new Error('timeout'))
        }, 12_000)
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void (async () => {
              const sendStatus = await channel.send({
                type: 'broadcast',
                event: 'redo_mission',
                payload: {
                  missionLogId: log.id,
                  dailyMissionId: dm.id,
                  title: log.missions?.title ?? '미션',
                },
              })
              if (settled) return
              settled = true
              window.clearTimeout(timeout)
              void supabase.removeChannel(channel)
              if (sendStatus === 'ok') resolve()
              else reject(new Error(typeof sendStatus === 'string' ? sendStatus : 'send'))
            })()
            return
          }
          if (status === 'CHANNEL_ERROR') {
            if (settled) return
            settled = true
            window.clearTimeout(timeout)
            void supabase.removeChannel(channel)
            reject(new Error('channel'))
          }
        })
      })

      showToast('자녀 화면에 알림을 보냈어요.')
    } catch {
      showToast('알림 전송에 실패했어요. 잠시 후 다시 시도해 주세요.', false)
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

      <PraiseStickerPanel childId={currentId} childName={currentChild?.name ?? '자녀'} />

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
            {requestsForChild.map((req) => {
              const frame = marketFrameKeyForItemId(req.item_id, req.item_name)
              return (
                <div key={req.id} className="rounded-2xl border-l-4 border-amber-400 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex gap-3">
                    {/* 자녀 마켓과 같은 스프라이트로 상품 그림을 보여 줍니다 */}
                    <div className="flex h-[88px] w-[88px] shrink-0 items-end justify-center overflow-visible rounded-2xl bg-amber-50/80 ring-1 ring-amber-100">
                      <SpriteImage sheet={MARKET_ITEMS} frame={frame} height={76} clipRotated={false} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-brand-text">{req.item_name}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{req.requested_at.slice(0, 10)}</p>
                      <p className="mt-1 font-black tabular-nums text-brand-blue">
                        {req.item_price.toLocaleString()} 크레딧
                      </p>
                      <p className="text-[10px] text-gray-400">{req.item_type === 'digital' ? '디지털' : '실물'}</p>
                      {req.child_message && (
                        <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1 text-xs italic text-gray-500">
                          &ldquo;{req.child_message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectModal({ requestId: req.id, itemName: req.item_name })}
                      disabled={loading === req.id}
                      className="rounded-xl border border-red-200 py-2.5 text-xs font-bold text-red-500 transition-all active:scale-95 disabled:opacity-50 sm:text-sm"
                    >
                      반려
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApprove(req.id, 'approve')}
                      disabled={loading === req.id}
                      className="rounded-xl bg-brand-blue py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 sm:text-sm"
                    >
                      {loading === req.id ? '…' : '승인'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApprove(req.id, 'instant')}
                      disabled={loading === req.id}
                      className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 sm:text-sm"
                    >
                      바로 구매
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 미션 롤백 — 탭하면 아래에서 시트가 올라오고, 시트 안에서 스크롤·최대 10건 + 더보기 */}
      <section>
        <h2 className="text-sm font-bold text-brand-text mb-2">미션 롤백</h2>
        <p className="text-xs text-gray-400 mb-2">
          오늘 완료한 미션을 여기서 관리해요. 눌러서 목록을 열고, 「다시하기」는 자녀 화면 안내 후 확인 시 되돌아가요.
        </p>

        <button
          type="button"
          onClick={() => {
            setRollbackSheetShowAll(false)
            setRollbackSheetOpen(true)
          }}
          className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-100 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-black text-brand-text">오늘 완료 미션</span>
              <span className="text-[11px] text-gray-400">탭하여 다시 하기 · 롤백</span>
            </div>
            <span className="shrink-0 rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-black tabular-nums text-brand-blue">
              {todayCompletedLogs.length}건
            </span>
            <span className="shrink-0 text-lg font-bold text-gray-300" aria-hidden>
              ›
            </span>
          </div>
        </button>

        {rollbackSheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="닫기"
              onClick={() => setRollbackSheetOpen(false)}
            />
            <div
              className="relative z-[1] flex max-h-[min(78dvh,560px)] flex-col rounded-t-3xl bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rollback-sheet-title"
            >
              <div className="flex justify-center pt-2 pb-1">
                <span className="h-1 w-10 rounded-full bg-gray-200" />
              </div>
              <div className="border-b border-gray-100 px-5 pb-3 pt-1">
                <h3 id="rollback-sheet-title" className="text-base font-black text-brand-text">
                  미션 롤백
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-gray-400">
                  오늘 완료분만 보여요. 「다시하기」는 자녀에게 알림이 갑니다.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                {todayCompletedLogs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">오늘 완료한 미션이 없어요</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {visibleRollbackInSheet.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 rounded-xl bg-gray-50/90 px-3 py-2.5 ring-1 ring-gray-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-brand-text">{log.missions?.title ?? '미션'}</p>
                          <p className="text-[10px] text-gray-400">{log.completed_at?.slice(0, 10)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-bold tabular-nums text-brand-blue">+{log.credit_earned} 크레딧</p>
                          <button
                            type="button"
                            onClick={() => void handleRequestRedoFromChild(log)}
                            disabled={loading === log.id}
                            className="text-[10px] font-bold text-orange-500 hover:underline disabled:opacity-50"
                          >
                            다시하기
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {todayCompletedLogs.length > ROLLBACK_SHEET_INITIAL && !rollbackSheetShowAll && (
                <div className="border-t border-gray-100 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setRollbackSheetShowAll(true)}
                    className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-brand-text"
                  >
                    더보기 ({todayCompletedLogs.length - ROLLBACK_SHEET_INITIAL}개 더 있음)
                  </button>
                </div>
              )}
              <div className="border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setRollbackSheetOpen(false)}
                  className="w-full rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-600"
                >
                  닫기
                </button>
              </div>
            </div>
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
