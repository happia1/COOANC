'use client'

/**
 * 부모 앱 — 승인 탭
 * - 상단은 홈과 같은 자녀 프로필 카드(다자녀 시 캐릭터 양 옆 ‹ ›·스와이프); 프로필 카드 탭 시 자녀 앱 진입(API); 구매 내역 등은 선택 자녀 기준.
 * - 구매 요청·미션 롤백은 선택 중인 자녀 기준으로만 표시합니다.
 * - 구매 요청: 대기·외부구매 중 — 파란 「승인」으로 도착 완료 처리(반려 없음). 「구매 요청」제목과 같은 줄 오른쪽 「최근구매내역」링크로 하단 시트에서 과거 건 확인.
 * - 최근 구매(승인) 내역: 오늘 완료 미션과 같은 하단 슬라이드 시트 — 최근 3건 먼저, 「더보기」로 전체.
 * - 미션 롤백: 카드 탭 시 하단 시트(스크롤, 10건까지 + 더보기). 「다시하기」는 API 롤백 후 자녀 앱이 daily_missions Realtime 으로 팝업·카드를 맞춥니다.
 *   자녀가 그날 미션을 모두 끝내고 수면 모드로 들어간 날에는 롤백이 막히며, 중앙 안내 창으로 알려 줍니다.
 * - 미션 롤백 아래: 자녀 마켓 메뉴 제어(상품 표시/숨김, 가족 전용 상품 추가).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import ParentEnterChildUiLink from '@/components/parent/ParentEnterChildUiLink'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import { useParentStore } from '@/store/parentStore'
import { useChildSiblingAvatarNav, type ChildTab } from '@/components/parent/ChildProfileNav'
import ParentMarketMenuControl from '@/components/parent/ParentMarketMenuControl'
import PraiseStickerPanel from '@/components/parent/PraiseStickerPanel'
import type { PurchaseRequest, StoreItem } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import MarketItemImage from '@/components/common/MarketItemImage'
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

/** 부모 화면에 쌓는 승인 내역(처리 종료 요청) 상한 — 서버도 동일 개수로 내려줍니다 */
const MAX_PARENT_REQUEST_HISTORY = 100

/** 승인 내역 시트에서 먼저 보이는 건수 — 그 이상은 「더보기」 (오늘 완료 미션 시트와 동일한 패턴) */
const PURCHASE_HISTORY_PREVIEW_COUNT = 3

/**
 * 자녀 홈이 구독하는 Realtime Broadcast 로 「다시하기」를 바로 알립니다.
 * 비개발자 설명: DB 변경 알림만으로는 늦거나 안 올 때가 있어, 부모 기기에서 짧은 실시간 신호를 한 번 보냅니다.
 */
function notifyChildMissionRollbackBroadcast(childId: string, dailyMissionId: string) {
  if (!childId || !dailyMissionId) return
  const supabase = createClient()
  const ch = supabase.channel(`child-parent-rollback-${childId}`)
  ch.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    void ch.send({
      type: 'broadcast',
      event: 'mission_rollback',
      payload: { dailyMissionId },
    })
    window.setTimeout(() => void supabase.removeChannel(ch), 1000)
  })
}

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
  /** 자녀별 마켓 상품 크레딧 덮어쓰기(메뉴 제어에서 수정 가능) */
  initialCreditOverridesByChild: Record<string, Record<string, number>>
}

export default function ApprovalTab({
  childrenProfiles,
  pendingRequests,
  requestHistory,
  recentLogs,
  storeItems: initialStoreItems,
  linkByChild,
  hiddenItemIdsByChild: initialHidden,
  initialCreditOverridesByChild,
}: Props) {
  /** 승인 탭은 Realtime 대신 주기적 조회(polling)로 안정성을 우선합니다. */
  const supabaseRef = useRef(createClient())

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

  /** 메뉴 제어 — 선택한 자녀마다 다른 크레딧 덮어쓰기(서버와 맞추기 위해 초기 스냅샷 키로 동기화) */
  const creditOverridesInitialKey = useMemo(
    () => JSON.stringify(initialCreditOverridesByChild),
    [initialCreditOverridesByChild],
  )
  const [creditOverridesByChild, setCreditOverridesByChild] = useState<Record<string, Record<string, number>>>(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const c of childrenProfiles) {
      m[c.id] = { ...(initialCreditOverridesByChild[c.id] ?? {}) }
    }
    return m
  })
  // creditOverridesInitialKey 에 자녀별 맵 전체가 들어 있으므로 키만 의존합니다(페이지 RSC 갱신 시 서버와 맞춤).
  useEffect(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const c of childrenProfiles) {
      m[c.id] = { ...(initialCreditOverridesByChild[c.id] ?? {}) }
    }
    setCreditOverridesByChild(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기 맵은 JSON 키에 전부 직렬화됨
  }, [creditOverridesInitialKey])

  /** 「받았어요」클릭 시 — 바로 도착 완료 vs 외부 쇼핑몰 안내(자녀 화면 별도 팝업) */
  const [approveChoiceModal, setApproveChoiceModal] = useState<{ requestId: string; itemName: string } | null>(
    null,
  )

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [rollbackSheetOpen, setRollbackSheetOpen] = useState(false)
  const [rollbackSheetShowAll, setRollbackSheetShowAll] = useState(false)
  /** 자녀 수면 모드 진입 후에는 그날 미션 롤백 불가 — API 가 알려 주면 이 창을 띄웁니다 */
  const [rollbackSleepLockModalOpen, setRollbackSleepLockModalOpen] = useState(false)
  /** 「최근구매내역」링크 — 오늘 완료 미션과 동일한 하단 슬라이드(바텀시트) 열림 여부 */
  const [purchaseHistorySheetOpen, setPurchaseHistorySheetOpen] = useState(false)

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

  /** 다자녀: 프로필 카드의 캐릭터 양 옆 ‹ › 과 동일 규칙 */
  const siblingNav = useChildSiblingAvatarNav(tabs)

  const requestsForChild = useMemo(
    () => (currentId ? requests.filter((r) => r.child_id === currentId) : []),
    [requests, currentId],
  )

  const historyForChild = useMemo(
    () => (currentId ? historyRequests.filter((r) => r.child_id === currentId) : []),
    [historyRequests, currentId],
  )

  /** 자녀를 바꾸면 승인 시트·목록 펼침을 초기화(다른 아이 데이터가 섞여 보이지 않게) */
  useEffect(() => {
    setPurchaseHistoryShowAll(false)
    setPurchaseHistorySheetOpen(false)
  }, [currentId])

  const visiblePurchaseHistory = useMemo(() => {
    if (purchaseHistoryShowAll) return historyForChild
    return historyForChild.slice(0, PURCHASE_HISTORY_PREVIEW_COUNT)
  }, [historyForChild, purchaseHistoryShowAll])

  /**
   * 구매 요청 카드 썸네일용 맵입니다.
   * - 예전에는 UUID만으로 그림 키를 뽑아(해시) 젤리인데 곰 그림처럼 **이름과 안 맞는** 일이 잦았습니다.
   * - 마켓과 같이 `store_items.image_url`이 있으면 그 주소를 쓰고, 없을 때만 기본 PNG를 씁니다.
   */
  const storeItemById = useMemo(() => {
    const m = new Map<string, StoreItem>()
    for (const it of storeItems) {
      m.set(it.id, it)
    }
    return m
  }, [storeItems])

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
    const supabase = supabaseRef.current
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

  /** 미션 로그는 수동 동작(롤백 후 재조회)으로만 맞추고 상시 Realtime 구독은 쓰지 않습니다. */

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
  const refreshPurchaseRequests = useCallback(async () => {
    const childIds = childrenProfiles.map((c) => c.id)
    if (childIds.length === 0) return
    const supabase = supabaseRef.current
    const [pendingRes, historyRes] = await Promise.all([
      supabase
        .from('purchase_requests')
        .select('*')
        .in('child_id', childIds)
        .in('status', ['pending', 'parent_buying'])
        .order('requested_at', { ascending: true }),
      supabase
        .from('purchase_requests')
        .select('*')
        .in('child_id', childIds)
        .in('status', ['approved', 'rejected', 'delivered'])
        .order('requested_at', { ascending: false })
        .limit(100),
    ])
    if (!pendingRes.error && pendingRes.data) setRequests(pendingRes.data as PurchaseRequest[])
    if (!historyRes.error && historyRes.data) setHistoryRequests(historyRes.data as PurchaseRequest[])
  }, [childrenProfiles])

  /** 구매 요청은 30초 polling + 탭 복귀 시 즉시 동기화합니다. */
  useEffect(() => {
    if (!familyChildIdsKey) return
    void refreshPurchaseRequests()
    const interval = window.setInterval(() => {
      void refreshPurchaseRequests()
    }, 30000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPurchaseRequests()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [familyChildIdsKey, refreshPurchaseRequests])

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

  /** 선택 자녀에 적용 중인 크레딧 덮어쓰기(없는 상품 id 는 DB 기본가 사용) */
  const creditOverridesForCurrent = useMemo(() => {
    if (!currentId) return {}
    return creditOverridesByChild[currentId] ?? {}
  }, [creditOverridesByChild, currentId])

  /** 메뉴 제어에서 크레딧 저장 API 성공 후 로컬 맵 갱신 */
  const onCreditOverrideSaved = useCallback(
    (itemId: string, nextOverride: number | null) => {
      if (!currentId) return
      setCreditOverridesByChild((prev) => {
        const row = { ...(prev[currentId] ?? {}) }
        if (nextOverride === null) delete row[itemId]
        else row[itemId] = nextOverride
        return { ...prev, [currentId]: row }
      })
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
      showToast('쇼핑 페이지를 열었어요. 주문 후 「승인」을 눌러 주세요.')
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
      let movedToHistory: PurchaseRequest | undefined
      setRequests((prev) => {
        movedToHistory = prev.find((r) => r.id === requestId)
        return prev.filter((r) => r.id !== requestId)
      })
      if (movedToHistory) {
        const at = new Date().toISOString()
        setHistoryRequests((h) =>
          mergeParentRequestHistory(h, {
            ...movedToHistory,
            status: 'delivered',
            approved_at: at,
          }),
        )
      }
      showToast('받음 처리했어요. 자녀 화면에 반영됩니다.')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  /**
   * 「다시하기」: 서버에서 즉시 롤백(카드·로그·크레딧·XP)합니다.
   * 자녀 기기는 Realtime(WebSocket)·Broadcast·DB 변경 구독으로 카드 복구와 안내 팝업을 받습니다.
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
      let json: { error?: string; dailyMissionId?: string; code?: string } = {}
      try {
        json = text ? (JSON.parse(text) as { error?: string; dailyMissionId?: string; code?: string }) : {}
      } catch {
        json = {}
      }
      if (!res.ok) {
        if (json.code === 'sleep_session_locked') {
          setRollbackSleepLockModalOpen(true)
        } else {
          showToast(json.error ?? '롤백에 실패했어요', false)
        }
        return
      }
      const dailyMissionId = typeof json.dailyMissionId === 'string' ? json.dailyMissionId : null
      if (!dailyMissionId) {
        showToast('일일 미션 정보를 받지 못했어요', false)
        return
      }

      notifyChildMissionRollbackBroadcast(log.child_id, dailyMissionId)

      await refreshChildMissionLogs()

      showToast('미션을 되돌렸어요.')
    } catch {
      showToast('롤백 중 오류가 났어요', false)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-4 flex flex-col gap-5">
      {toast && (
        <div
          className={`fixed top-6 left-1/2 z-[200] -translate-x-1/2 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${
            toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {rollbackSleepLockModalOpen && (
        <div
          className="fixed inset-0 z-[215] flex items-center justify-center bg-black/50 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rollback-sleep-lock-title"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 shadow-2xl">
            <h3 id="rollback-sleep-lock-title" className="mb-3 text-lg font-black text-gray-900">
              되돌리기를 할 수 없어요
            </h3>
            <p className="mb-6 text-sm font-semibold leading-relaxed text-gray-600">
              자녀가 그날 미션을 모두 완료한 뒤 수면 모드(잘자 화면)로 들어가면, 그날의 미션은 더 이상
              되돌릴 수 없어요. 거짓 완료를 막기 위한 설정이에요.
            </p>
            <button
              type="button"
              className="w-full rounded-2xl bg-brand-blue py-3.5 text-base font-black text-white shadow-md active:opacity-90"
              onClick={() => setRollbackSleepLockModalOpen(false)}
            >
              확인
            </button>
          </div>
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
            {/**
             * 보상 선택: 직접 보상(파랑) / 상품 구매(앰버) — 같은 블록 형태·테두리 없음
             */}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={loading === approveChoiceModal.requestId}
                onClick={() => {
                  const id = approveChoiceModal.requestId
                  setApproveChoiceModal(null)
                  void handleApprove(id)
                }}
                className="w-full rounded-xl border-0 bg-brand-blue py-3.5 text-sm font-black text-white shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                자녀에게 직접 보상
              </button>
              {/** 외부 쇼핑 연동 전까지 비활성 — 재개 시 disabled·문구 제거 후 handleParentShopPath 연결 */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="w-full cursor-not-allowed rounded-xl border-0 bg-amber-500 py-3.5 text-sm font-black text-white shadow-md opacity-55"
              >
                <span className="flex items-center justify-center gap-2">
                  <span>상품 구매하기</span>
                  <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                    (준비중)
                  </span>
                </span>
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

      {/* ── 2컬럼 그리드 ────────────────────────────────────────────────────────
          모바일(grid-cols-1): 좌 컬럼 → 우 컬럼 순 스택
          md+(grid-cols-2):   좌=프로필+구매요청(상단 링크로 최근내역 시트)+완료미션, 우=스티커+마켓제어
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 w-full items-start md:grid-cols-2">

      {/* ── 좌 컬럼: 프로필 + 구매 요청(+최근구매내역 링크) + 오늘 완료 미션 ── */}
      <div className="flex flex-col gap-5">

        {/* 통합 프로필 바 — RoutineTab과 동일 */}
        {currentChild && (
          <ParentEnterChildUiLink
            childId={currentChild.id}
            className="block w-full cursor-pointer rounded-2xl transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
            aria-label={`${currentChild.name} 자녀용 앱 화면으로 들어가기`}
            onClick={() => setSelectedChildId(currentChild.id)}
          >
            {/** 설정 탭과 동일한 프로필 본문(이름+Lv, 메타 라인)으로 맞추고 우측 통계는 유지 */}
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
              siblingNav={siblingNav}
              avatarEnterShortcut
            />
          </ParentEnterChildUiLink>
        )}

        {/**
         * 모바일 전용 배치:
         * - 요청사항에 맞춰 프로필 블록 바로 아래에 칭찬 스티커 보상 패널을 둡니다.
         * - 태블릿 가로(md 이상)는 기존 우측 컬럼 배치를 유지합니다.
         */}
        <div className="md:hidden">
          <PraiseStickerPanel childId={currentId} childName={currentChild?.name ?? '자녀'} />
        </div>

        {/**
         * 구매 요청 섹션 + 최근 내역 바텀시트를 한 덩어리로 묶음
         * - 제목 행·보조 문구·우측 링크: 메뉴 제어 블록과 같은 타이포·간격(상품 추가하기와 대응)
         */}
        <div className="flex flex-col gap-1.5">
        {/* 구매 요청 — 헤더·보조문·우측 링크는 ParentMarketMenuControl(메뉴 제어)과 동일 톤 */}
        <section id="parent-purchase-requests" className="mt-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold text-brand-text">구매 요청</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRollbackSheetOpen(false)
                  setPurchaseHistoryShowAll(false)
                  setPurchaseHistorySheetOpen(true)
                }}
                className="shrink-0 text-[11px] font-bold text-gray-400 underline-offset-2 hover:text-gray-500 hover:underline"
              >
                최근구매내역
              </button>
            </div>
          </div>
          <p className="mb-3 text-[11px] leading-snug text-gray-400">
            자녀가 크레딧으로 구매를 요청한 내역이에요.
          </p>

          <div className="mt-2 flex flex-col gap-3">
            {requestsForChild.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                <p className="text-sm text-gray-400">대기 중인 구매 요청이 없어요</p>
              </div>
            ) : (
              requestsForChild.map((req) => {
                const linked = req.item_id ? storeItemById.get(req.item_id) : undefined
                const rawUrl = linked?.image_url
                const thumbUrl = typeof rawUrl === 'string' && rawUrl.trim() !== '' ? rawUrl.trim() : null
                const frame = marketFrameKeyForItemId(req.item_id, req.item_name)
                const isParentBuying = req.status === 'parent_buying'
                return (
                  <div
                    key={req.id}
                    className="rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100"
                  >
                    <div className="flex flex-row items-start gap-2 sm:gap-3">
                      <div className="flex min-w-0 flex-1 gap-2 sm:gap-3">
                        <div
                          className={`flex h-[44px] w-[44px] shrink-0 items-end justify-center overflow-hidden rounded-xl ring-1 ${
                            isParentBuying ? 'bg-sky-50/80 ring-sky-100' : 'bg-amber-50/80 ring-amber-100'
                          }`}
                        >
                          {thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- 스토리지·외부 URL
                            <img
                              src={thumbUrl}
                              alt=""
                              className="max-h-full max-w-full object-contain object-bottom"
                              draggable={false}
                            />
                          ) : (
                            <MarketItemImage frame={frame} height={36} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-brand-text">{req.item_name}</p>
                          <p className="mt-0.5 text-[10px] text-gray-400">{req.requested_at.slice(0, 10)}</p>
                          <p className="mt-1 text-xs font-black tabular-nums text-brand-blue">
                            {req.item_price.toLocaleString()} 크레딧
                          </p>
                          {isParentBuying && (
                            <p className="mt-1.5 text-[9px] font-bold leading-snug text-sky-700">
                              외부에서 주문한 뒤 「승인」으로 자녀에게 알려 주세요.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 승인(파랑) — 클릭 시 보상 제공 모달 또는 즉시 도착 완료 */}
                      <div className="flex shrink-0 flex-col gap-1 self-center">
                        {isParentBuying ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleApprove(req.id) }}
                              disabled={loading === req.id}
                              className="rounded-xl border-0 bg-brand-blue px-4 py-2 text-[10px] font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                              {loading === req.id ? '…' : '승인'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open(PARENT_EXTERNAL_SHOP_URL, '_blank', 'noopener,noreferrer') }}
                              className="rounded-xl border-0 bg-amber-500 px-4 py-2 text-[10px] font-bold text-white shadow-sm transition-all active:scale-95"
                            >
                              쿠팡 열기
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setApproveChoiceModal({ requestId: req.id, itemName: req.item_name }) }}
                            disabled={loading === req.id}
                            className="rounded-xl border-0 bg-brand-blue px-4 py-2 text-[10px] font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          >
                            승인
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

          {/** 최근 구매(승인) 내역 바텀시트 — 「최근구매내역」버튼으로만 열림, 카드형 진입 UI는 제거됨 */}
          {purchaseHistorySheetOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end">
              {/** 딤: 탭 시 시트 닫기 */}
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
                {/** 상단 잡는 막대 — iOS 느낌의 시트 */}
                <div className="flex justify-center pt-2 pb-1">
                  <span className="h-1 w-10 rounded-full bg-gray-200" />
                </div>
                <div className="border-b border-gray-100 px-5 pb-3 pt-1">
                  <h3 id="purchase-history-sheet-title" className="text-base font-black text-brand-text">
                    최근 승인 내역
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                  {historyForChild.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">최근 승인·도착한 내역이 없어요</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {visiblePurchaseHistory.map((req) => {
                        const pill = purchaseRequestStatusPill(req.status)
                        return (
                          <li key={req.id} className="rounded-xl bg-gray-50/90 px-3 py-2 ring-1 ring-gray-100">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-sm font-bold text-brand-text">{req.item_name}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${pill.pillClass}`}>
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
                  )}
                </div>
                {historyForChild.length > PURCHASE_HISTORY_PREVIEW_COUNT && !purchaseHistoryShowAll && (
                  <div className="border-t border-gray-100 px-4 py-2">
                    {/** 3건 초과 시에만, 롤백 시트의 「더보기」자리와 동일 */}
                    <button
                      type="button"
                      onClick={() => setPurchaseHistoryShowAll(true)}
                      className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-brand-text"
                    >
                      더보기 ({historyForChild.length - PURCHASE_HISTORY_PREVIEW_COUNT}건 더)
                    </button>
                  </div>
                )}
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

        {/* 오늘 완료 미션 — 버튼 → 하단 시트 (모바일·태블릿 공통) */}
        <section>
          <button
            type="button"
            onClick={() => {
              setPurchaseHistorySheetOpen(false)
              setRollbackSheetShowAll(false)
              setRollbackSheetOpen(true)
            }}
            className="w-full rounded-2xl bg-white px-4 py-2.5 text-left shadow-sm ring-1 ring-gray-100 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-black text-brand-text">오늘 완료 미션</span>
                <span className="text-[11px] text-gray-400">탭하여 다시 하기 · 롤백</span>
              </div>
              <span className="shrink-0 rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-black tabular-nums text-brand-blue">
                {todayCompletedLogs.length}건
              </span>
              <span className="shrink-0 text-lg font-bold text-gray-300" aria-hidden>›</span>
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

      </div>{/* /좌 컬럼 */}

      {/* ── 우 컬럼: 칭찬 스티커 + 마켓 제어 ── */}
      <div className="flex flex-col gap-5">

        {/* 태블릿 가로/데스크톱 전용: 기존 위치 유지 */}
        <div className="hidden md:block">
          <PraiseStickerPanel childId={currentId} childName={currentChild?.name ?? '자녀'} />
        </div>

        {/* `id`: 홈 경제 EQ 코칭 카드의 「자녀 보상 등록」링크가 이 구역으로 스크롤되게 함 */}
        <section id="parent-approval-market-rewards" aria-label="자녀 마켓 보상 설정">
          <ParentMarketMenuControl
            childId={currentId}
            storeItems={storeItems}
            hiddenItemIds={hiddenSetForCurrent}
            familyLinkIdForChild={currentId ? linkByChild[currentId] ?? null : null}
            onHiddenChange={onHiddenChangeForCurrent}
            onItemCreated={(item) => setStoreItems((prev) => [...prev, item])}
            creditOverrides={creditOverridesForCurrent}
            onCreditOverrideSaved={onCreditOverrideSaved}
          />
        </section>

      </div>{/* /우 컬럼 */}

      </div>{/* /2컬럼 그리드 */}

    </div>
  )
}
