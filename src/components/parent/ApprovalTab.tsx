'use client'

/**
 * 부모 앱 — 승인 탭
 * - 상단은 루틴 탭과 같은 자녀 프로필 카드 + 다자녀 전환(스토어 selectedChildId 공유).
 * - 구매 요청·미션 롤백은 선택 중인 자녀 기준으로만 표시합니다.
 * - 구매 요청: 대기·외부구매 중 카드 아래에 승인 내역 진입 카드(탭 시 하단 시트, 최근 3건 + 더보기, 이미지 없음).
 * - 미션 롤백: 카드 탭 시 하단 시트(스크롤, 10건까지 + 더보기). 「다시하기」는 API 즉시 롤백 후 자녀에게 브로드캐스트 알림.
 * - 미션 롤백 아래: 자녀 마켓 메뉴 제어(상품 표시/숨김, 가족 전용 상품 추가).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
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
import {
  getMsUntilNextSeoulMidnight,
  getSeoulDateFromIsoTimestamp,
  getSeoulDateString,
} from '@/lib/koreaDate'
import { PARENT_EXTERNAL_SHOP_URL } from '@/constants/parentShop'
import { purchaseRequestStatusPill } from '@/lib/purchaseRequestStatusUi'

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

/** 부모 화면에 쌓는 승인 내역(처리 종료 요청) 상한 — 서버도 동일 개수로 내려줍니다 */
const MAX_PARENT_REQUEST_HISTORY = 100

/** 펼친 뒤 목록에서 먼저 보이는 건수 — 요청사항: 최근 5개 우선 표시 */
const PURCHASE_HISTORY_PREVIEW_COUNT = 5

function mergeParentRequestHistory(prev: PurchaseRequest[], row: PurchaseRequest): PurchaseRequest[] {
  const filtered = prev.filter((x) => x.id !== row.id)
  return [...filtered, row]
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
    .slice(0, MAX_PARENT_REQUEST_HISTORY)
}

/** 간단 목록 한 줄 날짜 — 도착 → 승인 → 요청 순으로 의미 있는 시점만 표시 */
function purchaseHistoryPrimaryDate(req: PurchaseRequest): string {
  const iso = req.delivered_at ?? req.approved_at ?? req.requested_at
  const ymd = iso.slice(0, 10)
  const [_, month = '', day = ''] = ymd.split('-')
  // 요청사항: 연도는 숨기고 월/일만 노출
  if (!month || !day) return ymd
  return `${month}.${day}`
}

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
  /** 승인 내역 목록(승인·반려·도착 완료) — 자녀 「내 요청 현황」과 같은 상태 뱃지 */
  requestHistory: PurchaseRequest[]
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
  requestHistory,
  recentLogs,
  storeItems: initialStoreItems,
  linkByChild,
  hiddenItemIdsByChild: initialHidden,
}: Props) {
  const pathname = usePathname()
  const { selectedChildId, setSelectedChildId } = useParentStore()

  /** 홈 코칭 카드에서 `#parent-approval-market-rewards` 로 올 때 마켓·보상 설정 구역으로 스크롤 */
  useEffect(() => {
    if (pathname !== '/parent/approval') return
    const id = 'parent-approval-market-rewards'
    if (typeof window === 'undefined' || window.location.hash !== `#${id}`) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [pathname])

  const [requests, setRequests] = useState<PurchaseRequest[]>(pendingRequests)
  const [historyRequests, setHistoryRequests] = useState<PurchaseRequest[]>(requestHistory)
  /** 승인 내역 하단 시트 열림 — 미션 롤백 시트와 같은 패턴 */
  const [purchaseHistorySheetOpen, setPurchaseHistorySheetOpen] = useState(false)
  /** 3건 초과분은 「더보기」로만 펼침 */
  const [purchaseHistoryShowAll, setPurchaseHistoryShowAll] = useState(false)
  const [logs, setLogs] = useState<MissionLog[]>(recentLogs)

  /** 서버(RSC)가 `router.refresh()` 등으로 새 목록을 내려줄 때 로컬 state 가 예전 스냅샷에 머물지 않도록 맞춤 */
  const pendingRequestsSyncKey = useMemo(
    () =>
      pendingRequests
        .map((r) => `${r.id}:${r.status}`)
        .sort()
        .join('|'),
    [pendingRequests],
  )
  const pendingRequestsRef = useRef(pendingRequests)
  pendingRequestsRef.current = pendingRequests
  useEffect(() => {
    setRequests(pendingRequestsRef.current)
  }, [pendingRequestsSyncKey])

  const requestHistorySyncKey = useMemo(
    () =>
      requestHistory
        .map((r) => `${r.id}:${r.status}`)
        .sort()
        .join('|'),
    [requestHistory],
  )
  const requestHistoryRef = useRef(requestHistory)
  requestHistoryRef.current = requestHistory
  useEffect(() => {
    setHistoryRequests(requestHistoryRef.current)
  }, [requestHistorySyncKey])
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
  /** 「승인」클릭 시 — 바로 승인 vs 외부 쇼핑몰 안내(자녀 화면 별도 팝업) */
  const [approveChoiceModal, setApproveChoiceModal] = useState<{ requestId: string; itemName: string } | null>(
    null,
  )

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [rollbackSheetOpen, setRollbackSheetOpen] = useState(false)
  const [rollbackSheetShowAll, setRollbackSheetShowAll] = useState(false)

  /**
   * 서울 기준 「오늘」 문자열 — 자정이 지나면 바뀌어야 `오늘 완료 미션` 목록이 비워집니다.
   * (로그 state만 두면 `useMemo`가 날짜를 다시 읽지 않아 어제 항목이 계속 보이던 문제를 막습니다.)
   */
  const [seoulDayKey, setSeoulDayKey] = useState(() => getSeoulDateString())

  /** 서울 자정마다 seoulDayKey 갱신 + 절전/백그라운드 후 복귀 시 날짜가 어긋났으면 맞춤 */
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    const bumpIfDateChanged = () => {
      const latest = getSeoulDateString()
      setSeoulDayKey((prev) => (prev === latest ? prev : latest))
    }

    const armMidnightTimer = () => {
      const ms = getMsUntilNextSeoulMidnight()
      timeoutId = setTimeout(() => {
        if (cancelled) return
        bumpIfDateChanged()
        armMidnightTimer()
      }, ms)
    }

    armMidnightTimer()

    const onBackToForeground = () => {
      if (document.visibilityState !== 'visible') return
      bumpIfDateChanged()
    }
    document.addEventListener('visibilitychange', onBackToForeground)
    window.addEventListener('focus', bumpIfDateChanged)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onBackToForeground)
      window.removeEventListener('focus', bumpIfDateChanged)
    }
  }, [])

  /** 날이 바뀌면 롤백 시트의 「더보기」 펼침 상태를 초기화(어제 기준 UI가 남지 않게) */
  useEffect(() => {
    setRollbackSheetShowAll(false)
  }, [seoulDayKey])

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

  const historyForChild = useMemo(
    () => (currentId ? historyRequests.filter((r) => r.child_id === currentId) : []),
    [historyRequests, currentId],
  )

  /** 자녀를 바꾸면 「더보기」 펼침을 초기화해 항상 3건부터 보이게 */
  useEffect(() => {
    setPurchaseHistoryShowAll(false)
  }, [currentId])

  /** 시트를 닫으면 다음에 열 때 다시 3건만 보이게 */
  useEffect(() => {
    if (!purchaseHistorySheetOpen) setPurchaseHistoryShowAll(false)
  }, [purchaseHistorySheetOpen])

  const visiblePurchaseHistory = useMemo(() => {
    if (purchaseHistoryShowAll) return historyForChild
    return historyForChild.slice(0, PURCHASE_HISTORY_PREVIEW_COUNT)
  }, [historyForChild, purchaseHistoryShowAll])

  const purchaseHistoryHasMore = historyForChild.length > PURCHASE_HISTORY_PREVIEW_COUNT

  const logsForChild = useMemo(
    () => (currentId ? logs.filter((l) => l.child_id === currentId) : []),
    [logs, currentId],
  )

  /**
   * 「오늘 완료」= 완료 시각(completed_at)의 **서울 달력 날짜**가 오늘인 로그만.
   * - 배정일(assigned_date)만 맞추면 UTC 표시·자정 경계에서 어제로 보이는 문제가 생깁니다.
   * - 안내 문구「오늘 완료분」과 동일한 기준입니다.
   */
  const todayCompletedLogs = useMemo(() => {
    return logsForChild.filter((l) => {
      if (!l.completed_at) return false
      const doneSeoul = getSeoulDateFromIsoTimestamp(l.completed_at)
      return doneSeoul !== null && doneSeoul === seoulDayKey
    })
  }, [logsForChild, seoulDayKey])

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

  /**
   * 주소에 `#parent-purchase-requests` 가 있으면 구매 요청 섹션으로 스크롤합니다.
   * (모달의 「구매 요청 확인하기」, 북마크, 브라우저 뒤로가기 등)
   */
  useEffect(() => {
    if (pathname !== '/parent/approval') return

    function scrollIfHash() {
      if (typeof window === 'undefined') return
      if (window.location.hash !== '#parent-purchase-requests') return
      document.getElementById('parent-purchase-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    scrollIfHash()
    window.addEventListener('hashchange', scrollIfHash)
    return () => window.removeEventListener('hashchange', scrollIfHash)
  }, [pathname])

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

  /**
   * 자녀가 마켓에서 구매 요청을 넣으면 DB INSERT 가 먼저 일어나고, 부모 승인 탭 목록은
   * 이전에는 Realtime 구독이 없어 새로고침 전까지 비어 있던 것처럼 보였습니다.
   * 가족에 연결된 자녀 id 만 반영합니다(RLS 와 동일한 신뢰 경계).
   */
  const familyChildIdsKey = useMemo(
    () =>
      [...childrenProfiles]
        .map((c) => c.id)
        .sort()
        .join(','),
    [childrenProfiles],
  )
  useEffect(() => {
    const childIdSet = new Set(childrenProfiles.map((c) => c.id))
    if (childIdSet.size === 0) return
    const supabase = createClient()
    const channel = supabase
      .channel(`approval_purchase_requests:${familyChildIdsKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as PurchaseRequest
            if (!r.child_id || !childIdSet.has(r.child_id)) return
            if (r.status !== 'pending') return
            setRequests((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]))
            return
          }
          if (payload.eventType === 'UPDATE') {
            const r = payload.new as PurchaseRequest
            if (!r.child_id || !childIdSet.has(r.child_id)) return
            const terminal = r.status === 'approved' || r.status === 'rejected' || r.status === 'delivered'
            if (terminal) {
              setRequests((prev) => prev.filter((x) => x.id !== r.id))
              setHistoryRequests((prev) => mergeParentRequestHistory(prev, r))
              return
            }
            if (r.status === 'pending' || r.status === 'parent_buying') {
              setHistoryRequests((prev) => prev.filter((x) => x.id !== r.id))
              setRequests((prev) => {
                const i = prev.findIndex((x) => x.id === r.id)
                if (i >= 0) {
                  const copy = [...prev]
                  copy[i] = r
                  return copy
                }
                return [r, ...prev]
              })
            }
            return
          }
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string } | null)?.id
            if (!oldId) return
            setRequests((prev) => prev.filter((x) => x.id !== oldId))
            setHistoryRequests((prev) => prev.filter((x) => x.id !== oldId))
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [familyChildIdsKey, childrenProfiles])

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

  /** 외부 쇼핑(플레이스홀더 URL) — DB 는 `parent_buying`, 자녀는 실시간으로 안내 팝업 */
  async function handleParentShopPath(requestId: string) {
    setLoading(requestId)
    try {
      const res = await fetch('/api/market/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'parent_shop' }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '처리에 실패했어요', false)
        return
      }
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'parent_buying' as const } : r)),
      )
      window.open(PARENT_EXTERNAL_SHOP_URL, '_blank', 'noopener,noreferrer')
      showToast('쇼핑 페이지를 열었어요. 주문 후 「배달 승인」을 눌러 주세요.')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  /** 서버에서는 항상 같은 「승인」처리입니다 */
  async function handleApprove(requestId: string) {
    setLoading(requestId)
    try {
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '277560' },
        body: JSON.stringify({
          sessionId: '277560',
          runId: 'pre-approve',
          hypothesisId: 'E',
          location: 'ApprovalTab.tsx:handleApprove:start',
          message: 'parent clicked approve',
          data: { requestId },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      const res = await fetch('/api/market/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve' }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '277560' },
        body: JSON.stringify({
          sessionId: '277560',
          runId: 'pre-approve',
          hypothesisId: 'E',
          location: 'ApprovalTab.tsx:handleApprove:response',
          message: 'parent approve fetch result',
          data: {
            requestId,
            httpStatus: res.status,
            error: typeof json.error === 'string' ? json.error : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요', false)
        return
      }
      let movedToHistory: PurchaseRequest | undefined
      setRequests((prev) => {
        movedToHistory = prev.find((r) => r.id === requestId)
        return prev.filter((r) => r.id !== requestId)
      })
      if (movedToHistory) {
        setHistoryRequests((h) =>
          mergeParentRequestHistory(h, {
            ...movedToHistory,
            status: 'approved',
            approved_at: new Date().toISOString(),
          }),
        )
      }
      showToast('승인했어요. 자녀에게 전달됩니다.')
    } catch {
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '277560' },
        body: JSON.stringify({
          sessionId: '277560',
          runId: 'pre-approve',
          hypothesisId: 'E',
          location: 'ApprovalTab.tsx:handleApprove:catch',
          message: 'parent approve threw exception',
          data: { requestId },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
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
      const rid = rejectModal.requestId
      const note = rejectNote || null
      let rejectedRow: PurchaseRequest | undefined
      setRequests((prev) => {
        rejectedRow = prev.find((r) => r.id === rid)
        return prev.filter((r) => r.id !== rid)
      })
      if (rejectedRow) {
        setHistoryRequests((h) =>
          mergeParentRequestHistory(h, { ...rejectedRow, status: 'rejected', parent_note: note }),
        )
      }
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
   * 「다시하기」: 서버에서 즉시 롤백(카드·로그·크레딧·XP)한 뒤, Realtime 으로 자녀 화면에만 안내합니다.
   * 브로드캐스트가 잠깐 실패해도 DB 는 이미 맞춰져 있고, 자녀 쪽은 child_stats 실시간 갱신으로 수치는 맞습니다.
   */
  async function handleRequestRedoFromChild(log: MissionLog) {
    if (!currentId) return
    setLoading(log.id)
    try {
      const res = await fetch('/api/mission/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionLogId: log.id }),
      })
      const text = await res.text()
      let json: { error?: string; dailyMissionId?: string } = {}
      try {
        json = text ? (JSON.parse(text) as { error?: string; dailyMissionId?: string }) : {}
      } catch {
        json = {}
      }
      if (!res.ok) {
        showToast(json.error ?? '롤백에 실패했어요', false)
        return
      }
      const dailyMissionId = typeof json.dailyMissionId === 'string' ? json.dailyMissionId : null
      if (!dailyMissionId) {
        showToast('일일 미션 정보를 받지 못했어요', false)
        return
      }

      await refreshChildMissionLogs()

      const supabase = createClient()
      const channel = supabase.channel(`mission_redo:${currentId}`, { config: { broadcast: { ack: false } } })
      await new Promise<void>((resolve) => {
        let settled = false
        const timeout = window.setTimeout(() => {
          if (settled) return
          settled = true
          void supabase.removeChannel(channel)
          resolve()
        }, 4000)
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void (async () => {
              await channel.send({
                type: 'broadcast',
                event: 'mission_rolled_back',
                payload: {
                  dailyMissionId,
                  title: log.missions?.title ?? '미션',
                },
              })
              if (settled) return
              settled = true
              window.clearTimeout(timeout)
              void supabase.removeChannel(channel)
              resolve()
            })()
            return
          }
          if (status === 'CHANNEL_ERROR') {
            if (settled) return
            settled = true
            window.clearTimeout(timeout)
            void supabase.removeChannel(channel)
            resolve()
          }
        })
      })

      showToast('미션을 되돌렸어요. 자녀에게 알림을 보냈어요.')
    } catch {
      showToast('롤백 중 오류가 났어요', false)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {toast && (
        <div
          className={`fixed top-6 left-1/2 z-[200] -translate-x-1/2 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${
            toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {approveChoiceModal && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-choice-title"
          onClick={() => setApproveChoiceModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white px-6 py-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="approve-choice-title" className="text-center text-base font-black leading-snug text-brand-text">
              보상 제공
            </p>
            <p className="mt-2 text-center text-xs leading-relaxed text-gray-500">
              자녀에게 바로 보상을 제공하시겠어요?
              <br />
              상품 구매를 원하실 경우 상품구매하기에서 주문이 가능합니다.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={loading === approveChoiceModal.requestId}
                onClick={() => {
                  const id = approveChoiceModal.requestId
                  setApproveChoiceModal(null)
                  void handleApprove(id)
                }}
                className="w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-black text-white shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                네
              </button>
              <button
                type="button"
                disabled={loading === approveChoiceModal.requestId}
                onClick={() => {
                  const id = approveChoiceModal.requestId
                  setApproveChoiceModal(null)
                  void handleParentShopPath(id)
                }}
                className="w-full rounded-2xl border-2 border-amber-400 bg-amber-50 py-3.5 text-sm font-black text-amber-900 shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                상품 구매하기
              </button>
              <button
                type="button"
                onClick={() => setApproveChoiceModal(null)}
                className="w-full rounded-2xl py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <>
          {/* 하단 독바보다 위(z-[100]) — 반려 시트가 가리지 않도록 */}
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40">
            <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl">
              <p className="mb-1 text-base font-black text-brand-text">반려 사유 선택</p>
              <p className="mb-4 text-xs text-gray-400">{rejectModal.itemName}</p>

              <div className="mb-4 flex flex-col gap-2">
                {REJECT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectNote(preset)}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
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
                className="mb-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModal(null)
                    setRejectNote('')
                  }}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!!loading}
                  className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white shadow-md active:scale-95 disabled:opacity-50"
                >
                  반려하기
                </button>
              </div>
            </div>
          </div>
        </>
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

      {/* 구매 요청 — 선택 자녀만 (`#parent-purchase-requests` 로 스크롤 이동) */}
      <section id="parent-purchase-requests">
        <h2 className="text-sm font-bold text-brand-text mb-2">구매 요청</h2>

        {requestsForChild.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">대기 중인 구매 요청이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requestsForChild.map((req) => {
              const frame = marketFrameKeyForItemId(req.item_id, req.item_name)
              const isParentBuying = req.status === 'parent_buying'
              return (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition-all active:scale-[0.99]"
                >
                  <div className="flex flex-row items-start gap-2 sm:gap-3">
                    <div className="flex min-w-0 flex-1 gap-2 sm:gap-3">
                      <div
                        /** 요청사항 반영: 이전보다 이미지를 조금 키워 가독성 보완 */
                        className={`flex h-[52px] w-[52px] shrink-0 items-end justify-center overflow-visible rounded-xl ring-1 ${
                          isParentBuying ? 'bg-sky-50/80 ring-sky-100' : 'bg-amber-50/80 ring-amber-100'
                        }`}
                      >
                        <SpriteImage sheet={MARKET_ITEMS} frame={frame} height={44} clipRotated={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/** 요청사항 반영: 텍스트 크기를 한 단계 더 줄여 카드 밀도 개선 */}
                        <p className="text-xs font-black text-brand-text">{req.item_name}</p>
                        <p className="mt-0.5 text-[10px] text-gray-400">{req.requested_at.slice(0, 10)}</p>
                        <p className="mt-1 text-xs font-black tabular-nums text-brand-blue">
                          {req.item_price.toLocaleString()} 크레딧
                        </p>
                        {isParentBuying && (
                          <p className="mt-1.5 text-[9px] font-bold leading-snug text-sky-700">
                            외부에서 주문한 뒤 「배달 승인」으로 자녀에게 알려 주세요.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex w-[4.25rem] shrink-0 flex-col gap-1 self-start pt-0.5 sm:w-[4.5rem]">
                      {isParentBuying ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setRejectModal({ requestId: req.id, itemName: req.item_name })}
                            disabled={loading === req.id}
                            className="w-full rounded-lg border border-red-200 py-1.5 text-[9px] font-bold text-red-500 transition-all active:scale-95 disabled:opacity-50 sm:rounded-xl sm:py-2"
                          >
                            반려
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(PARENT_EXTERNAL_SHOP_URL, '_blank', 'noopener,noreferrer')
                            }
                            className="w-full rounded-lg bg-amber-500 py-1.5 text-[9px] font-bold text-white shadow-md transition-all active:scale-95 sm:rounded-xl sm:py-2"
                          >
                            쿠팡 열기
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleApprove(req.id)}
                            disabled={loading === req.id}
                            className="w-full rounded-lg bg-brand-blue py-1.5 text-[9px] font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 sm:rounded-xl sm:py-2"
                          >
                            {loading === req.id ? '…' : '배달 승인'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setRejectModal({ requestId: req.id, itemName: req.item_name })}
                            disabled={loading === req.id}
                            className="w-full rounded-lg border border-red-200 py-1.5 text-[9px] font-bold text-red-500 transition-all active:scale-95 disabled:opacity-50 sm:rounded-xl sm:py-2"
                          >
                            반려
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setApproveChoiceModal({ requestId: req.id, itemName: req.item_name })
                            }
                            disabled={loading === req.id}
                            className="w-full rounded-lg bg-brand-blue py-1.5 text-[9px] font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 sm:rounded-xl sm:py-2"
                          >
                            승인
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {historyForChild.length > 0 && (
          <div className={requestsForChild.length > 0 ? 'mt-5' : 'mt-0'}>
            <button
              type="button"
              onClick={() => {
                setPurchaseHistoryShowAll(false)
                setPurchaseHistorySheetOpen(true)
              }}
              className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-100 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-black text-brand-text">승인 내역</span>
                  <span className="text-[11px] text-gray-400">탭하여 목록 보기</span>
                </div>
                <span className="shrink-0 rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-black tabular-nums text-brand-blue">
                  {historyForChild.length}건
                </span>
                <span className="shrink-0 text-lg font-bold text-gray-300" aria-hidden>
                  ›
                </span>
              </div>
            </button>

            {purchaseHistorySheetOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/45"
                  aria-label="닫기"
                  onClick={() => setPurchaseHistorySheetOpen(false)}
                />
                <div
                  className="relative z-[1] flex max-h-[min(78dvh,560px)] flex-col rounded-t-3xl bg-white shadow-2xl"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="purchase-history-sheet-title"
                >
                  <div className="flex justify-center pt-2 pb-1">
                    <span className="h-1 w-10 rounded-full bg-gray-200" />
                  </div>
                  <div className="border-b border-gray-100 px-5 pb-3 pt-1">
                    <h3 id="purchase-history-sheet-title" className="text-base font-black text-brand-text">
                      승인 내역
                    </h3>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                    <ul className="flex flex-col gap-1.5">
                      {visiblePurchaseHistory.map((req) => {
                        const pill = purchaseRequestStatusPill(req.status)
                        return (
                          <li
                            key={req.id}
                            className="rounded-xl bg-gray-50/90 px-3 py-2.5 ring-1 ring-gray-100"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-sm font-bold text-brand-text">{req.item_name}</p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${pill.pillClass}`}
                              >
                                {pill.label}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] tabular-nums text-gray-400">
                              {purchaseHistoryPrimaryDate(req)} · {req.item_price.toLocaleString()}크레딧
                            </p>
                            {req.status === 'rejected' && req.parent_note ? (
                              <p className="mt-1 line-clamp-2 text-[10px] text-gray-500">사유: {req.parent_note}</p>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  {purchaseHistoryHasMore ? (
                    <div className="border-t border-gray-100 px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setPurchaseHistoryShowAll((v) => !v)}
                        className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-brand-text"
                      >
                        {purchaseHistoryShowAll
                          ? `간단히 보기 (${PURCHASE_HISTORY_PREVIEW_COUNT}건)`
                          : `더보기 (${historyForChild.length - PURCHASE_HISTORY_PREVIEW_COUNT}건 더)`}
                      </button>
                    </div>
                  ) : null}
                  <div className="border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <button
                      type="button"
                      onClick={() => setPurchaseHistorySheetOpen(false)}
                      className="w-full rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-600"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 오늘 완료 미션 — 카드 탭 시 하단 시트(스크롤, 최대 10건 + 더보기) */}
      <section>
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
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
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
                  오늘 완료 미션
                </h3>
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
                          <p className="text-[10px] text-gray-400">
                            {log.completed_at
                              ? getSeoulDateFromIsoTimestamp(log.completed_at) ?? log.completed_at.slice(0, 10)
                              : ''}
                          </p>
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

      {/* `id`: 홈 경제 EQ 코칭 카드의 「자녀 보상 등록」링크가 이 구역으로 스크롤되게 함 */}
      <section id="parent-approval-market-rewards" aria-label="자녀 마켓 보상 설정">
        <ParentMarketMenuControl
          childId={currentId}
          storeItems={storeItems}
          hiddenItemIds={hiddenSetForCurrent}
          familyLinkIdForChild={currentId ? linkByChild[currentId] ?? null : null}
          onHiddenChange={onHiddenChangeForCurrent}
          onItemCreated={(item) => setStoreItems((prev) => [...prev, item])}
        />
      </section>

    </div>
  )
}
