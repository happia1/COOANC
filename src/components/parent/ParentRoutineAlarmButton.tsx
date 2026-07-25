'use client'

/**
 * 부모 상단바 — 알림·공지 아이콘 + 알람시계 두 버튼을 한 묶음으로 둡니다.
 * - 알림·공지: `notice.png`. 구매 승인 대기는 요청 id 단위로 「확인」하면 사라지며(localStorage), 새 요청은 다시 뜹니다.
 * - 알람시계: `alarm.png` 로 루틴 알람 설정 시트만 엽니다.
 * - purchase_requests 변경은 Realtime 으로 목록을 다시 읽습니다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getCachedParentChildIds } from '@/lib/browserParentAuthCache'
import {
  pruneAcknowledgedToCurrentPending,
  readAcknowledgedPurchaseRequestIds,
  writeAcknowledgedPurchaseRequestIds,
} from '@/lib/parentBellPurchaseAck'
import ParentBellBoardSheet from '@/components/parent/ParentBellBoardSheet'
import RoutineAlarmSettingsSheet from '@/components/parent/RoutineAlarmSettingsSheet'
import { OPEN_NOTICE_CENTER_EVENT, type OpenNoticeCenterDetail } from '@/lib/noticeCenterBus'

/** 알림·공지(벨) 버튼용 PNG — `public/assets/img/common/ui/notice.png` */
const PARENT_NOTICE_BELL_ICON_SRC = '/assets/img/common/ui/notice.png' as const

type Props = {
  /** 서버 레이아웃에서 내려준 대기 건수 — 첫 fetch 전 뱃지 추정용 */
  initialPendingApprovalCount: number
}

export default function ParentRoutineAlarmButton({ initialPendingApprovalCount }: Props) {
  const [boardOpen, setBoardOpen] = useState(false)
  const [routineOpen, setRoutineOpen] = useState(false)
  /** 팝업의 "더 보기" 등으로 공지센터를 열 때, 펼쳐서 보여 줄 공지 id */
  const [focusNoticeId, setFocusNoticeId] = useState<string | null>(null)
  /** 현재 DB 기준 대기 중인 purchase_requests.id 목록 */
  const [pendingRequestIds, setPendingRequestIds] = useState<string[]>([])
  /** 시트에서 확인 처리한 id(브라우저 저장소와 동기) */
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set())
  /** 첫 번째 대기 목록 fetch 가 끝났는지 — 뱃지를 서버 숫자와 맞출 때 사용 */
  const [fetchDone, setFetchDone] = useState(false)

  /**
   * 최근 10분 이내에 미확인된 연속 탭 알림 목록.
   * 각 항목: { id, child_id, detected_at, mission_count }
   */
  const [rapidTapAlerts, setRapidTapAlerts] = useState<{
    id: string
    child_id: string
    detected_at: string
    mission_count: number
  }[]>([])

  /** 확인해 둔 id 를 DB 에서 불러옵니다(기기 간 동일) */
  useEffect(() => {
    let cancelled = false
    void readAcknowledgedPurchaseRequestIds().then((ids) => {
      if (!cancelled) setAcknowledgedIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * 다른 부품(앱 실행 팝업의 "더 보기")이 "공지센터 열어줘" 신호를 보내면,
   * 보드를 열고 펼쳐서 보여 줄 공지 id 를 시트로 전달합니다.
   */
  useEffect(() => {
    const onOpenNoticeCenter = (e: Event) => {
      const detail = (e as CustomEvent<OpenNoticeCenterDetail>).detail
      setFocusNoticeId(detail?.noticeId ?? null)
      setBoardOpen(true)
    }
    window.addEventListener(OPEN_NOTICE_CENTER_EVENT, onOpenNoticeCenter)
    return () => window.removeEventListener(OPEN_NOTICE_CENTER_EVENT, onOpenNoticeCenter)
  }, [])

  /**
   * 연결 자녀 기준 구매 대기 + 연속 탭 알림을 갱신합니다.
   * Auth `/user` 는 치지 않고 로컬 세션(`getSession`)만 사용합니다.
   */
  const refreshBellHubData = useCallback(async () => {
    const supabase = createClient()
    const childIds = await getCachedParentChildIds(supabase)
    if (childIds.length === 0) {
      setPendingRequestIds([])
      setRapidTapAlerts([])
      setFetchDone(true)
      return
    }
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const [purchaseRes, rapidRes] = await Promise.all([
      supabase
        .from('purchase_requests')
        .select('id')
        .in('child_id', childIds)
        .in('status', ['pending', 'parent_buying']),
      supabase
        .from('rapid_tap_alerts')
        .select('id, child_id, detected_at, mission_count')
        .in('child_id', childIds)
        .eq('acknowledged', false)
        .gte('detected_at', tenMinutesAgo)
        .order('detected_at', { ascending: false })
        .limit(5),
    ])
    if (purchaseRes.error) {
      console.warn('[parent bell hub] pending rows:', purchaseRes.error.message)
    } else {
      const ids = (purchaseRes.data ?? []).map((r: { id: string }) => r.id)
      setPendingRequestIds(ids)
      /** 처리된 요청은 DB 의 cascade 가 정리하므로 여기서는 화면 표시만 좁힙니다 */
      setAcknowledgedIds((prev) => pruneAcknowledgedToCurrentPending(prev, ids))
    }
    if (rapidRes.error) {
      console.warn('[parent bell hub] rapid_tap_alerts:', rapidRes.error.message)
    } else {
      setRapidTapAlerts(
        (rapidRes.data ?? []) as { id: string; child_id: string; detected_at: string; mission_count: number }[],
      )
    }
    setFetchDone(true)
  }, [])

  /** 연속 탭 알림을 확인 처리합니다(acknowledged = true). */
  const acknowledgeRapidTapAlerts = useCallback(async () => {
    if (rapidTapAlerts.length === 0) return
    const supabase = createClient()
    const ids = rapidTapAlerts.map((a) => a.id)
    await supabase
      .from('rapid_tap_alerts')
      .update({ acknowledged: true })
      .in('id', ids)
    setRapidTapAlerts([])
  }, [rapidTapAlerts])

  useEffect(() => {
    void refreshBellHubData()
    const interval = window.setInterval(() => {
      void refreshBellHubData()
    }, 30000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshBellHubData()
      }
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshBellHubData])

  /** 아직 시트에서 확인하지 않은 대기 요청만 */
  const unreadPendingIds = useMemo(
    () => pendingRequestIds.filter((id) => !acknowledgedIds.has(id)),
    [pendingRequestIds, acknowledgedIds],
  )
  const unreadPendingCount = unreadPendingIds.length

  /** 첫 fetch 전에는 서버 건수로 뱃지를 보여 주고, 이후에는 미확인 건만 셉니다 */
  const baseBadgeCount = fetchDone ? unreadPendingCount : initialPendingApprovalCount
  /** 연속 탭 알림도 뱃지에 합산합니다 */
  const badgeCount = baseBadgeCount + rapidTapAlerts.length
  const hasParentAlarms = badgeCount > 0

  /** 승인 탭으로 가기 직전: 현재 보이던 대기 건을 모두 「확인」처리 */
  const acknowledgePurchaseNotifications = useCallback(() => {
    const pruned = pruneAcknowledgedToCurrentPending(new Set(pendingRequestIds), pendingRequestIds)
    setAcknowledgedIds(pruned)
    /** DB 에 저장해 다른 기기(폰·태블릿)에서도 뱃지가 함께 사라지게 합니다 */
    void writeAcknowledgedPurchaseRequestIds(pruned)
  }, [pendingRequestIds])

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setBoardOpen(true)}
          className="relative flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80"
          aria-label={
            hasParentAlarms
              ? `알림·공지 열기, 구매 승인 대기 ${badgeCount}건`
              : '알림·공지 열기'
          }
        >
          <span
            className={`flex h-5 w-5 items-center justify-center ${hasParentAlarms ? 'motion-safe:animate-parent-alarm-bell' : ''}`}
          >
            <Image src={PARENT_NOTICE_BELL_ICON_SRC} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </span>
          {hasParentAlarms ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black leading-none text-white shadow-sm"
              aria-hidden
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setRoutineOpen(true)}
          className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80"
          aria-label="루틴 알람 설정"
        >
          <Image src="/assets/img/common/ui/alarm.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
        </button>
      </div>

      <ParentBellBoardSheet
        open={boardOpen}
        onClose={() => {
          setBoardOpen(false)
          setFocusNoticeId(null)
        }}
        focusNoticeId={focusNoticeId}
        unreadPendingCount={unreadPendingCount}
        onAcknowledgePurchaseNotifications={acknowledgePurchaseNotifications}
        rapidTapAlerts={rapidTapAlerts}
        onAcknowledgeRapidTapAlerts={acknowledgeRapidTapAlerts}
      />

      <RoutineAlarmSettingsSheet open={routineOpen} onClose={() => setRoutineOpen(false)} />
    </>
  )
}
