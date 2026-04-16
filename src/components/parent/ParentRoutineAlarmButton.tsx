'use client'

/**
 * 부모 상단바 — 알림·공지 아이콘 + 알람시계 두 버튼을 한 묶음으로 둡니다.
 * - 알림·공지: `notice.png`. 구매 승인 대기는 요청 id 단위로 「확인」하면 사라지며(localStorage), 새 요청은 다시 뜹니다.
 * - 알람시계: `alarm.png` 로 루틴 알람 설정 시트만 엽니다.
 * - purchase_requests 변경은 Realtime 으로 목록을 다시 읽습니다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  pruneAcknowledgedToCurrentPending,
  readAcknowledgedPurchaseRequestIds,
  writeAcknowledgedPurchaseRequestIds,
} from '@/lib/parentBellPurchaseAck'
import ParentBellBoardSheet from '@/components/parent/ParentBellBoardSheet'
import RoutineAlarmSettingsSheet from '@/components/parent/RoutineAlarmSettingsSheet'

/** 알림·공지(벨) 버튼용 PNG — `public/assets/img/common/ui/notice.png` */
const PARENT_NOTICE_BELL_ICON_SRC = '/assets/img/common/ui/notice.png' as const

type Props = {
  /** 서버 레이아웃에서 내려준 대기 건수 — 첫 fetch 전 뱃지 추정용 */
  initialPendingApprovalCount: number
}

export default function ParentRoutineAlarmButton({ initialPendingApprovalCount }: Props) {
  const [boardOpen, setBoardOpen] = useState(false)
  const [routineOpen, setRoutineOpen] = useState(false)
  /** 현재 DB 기준 대기 중인 purchase_requests.id 목록 */
  const [pendingRequestIds, setPendingRequestIds] = useState<string[]>([])
  /** 시트에서 확인 처리한 id(브라우저 저장소와 동기) */
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set())
  /** 첫 번째 대기 목록 fetch 가 끝났는지 — 뱃지를 서버 숫자와 맞출 때 사용 */
  const [fetchDone, setFetchDone] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  /** 클라이언트에서만: 예전에 확인해 둔 id 를 불러옵니다 */
  useEffect(() => {
    setAcknowledgedIds(readAcknowledgedPurchaseRequestIds())
  }, [])

  const refreshPendingPurchaseRows = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setPendingRequestIds([])
      setFetchDone(true)
      return
    }
    const { data: links } = await supabase.from('family_links').select('child_id').eq('parent_id', user.id)
    const childIds = (links ?? []).map((r: { child_id: string }) => r.child_id)
    if (childIds.length === 0) {
      setPendingRequestIds([])
      setFetchDone(true)
      return
    }
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('id')
      .in('child_id', childIds)
      .in('status', ['pending', 'parent_buying'])
    if (error) {
      console.warn('[parent bell hub] pending rows:', error.message)
      setFetchDone(true)
      return
    }
    const ids = (data ?? []).map((r: { id: string }) => r.id)
    setPendingRequestIds(ids)
    setAcknowledgedIds((prev) => {
      const pruned = pruneAcknowledgedToCurrentPending(prev, ids)
      if (pruned.size !== prev.size) writeAcknowledgedPurchaseRequestIds(pruned)
      return pruned
    })
    setFetchDone(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let childIdSet = new Set<string>()

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'parent' || cancelled) return
      const { data: links } = await supabase.from('family_links').select('child_id').eq('parent_id', user.id)
      childIdSet = new Set((links ?? []).map((r: { child_id: string }) => r.child_id))
      if (childIdSet.size === 0 || cancelled) return

      const channel = supabase
        .channel(`parent_topbar_pending_requests:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'purchase_requests' },
          (payload) => {
            const row = (payload.new ?? payload.old) as { child_id?: string } | null
            if (!row?.child_id || !childIdSet.has(row.child_id)) return
            void refreshPendingPurchaseRows()
          },
        )
        .subscribe()

      /** 언마운트가 먼저 끝난 뒤 채널이 붙으면 ref 만 비우고 끊지 못해 누수가 나지 않게 합니다 */
      if (cancelled) {
        void supabase.removeChannel(channel)
        return
      }
      channelRef.current = channel
      void refreshPendingPurchaseRows()
    })()

    return () => {
      cancelled = true
      const ch = channelRef.current
      channelRef.current = null
      if (ch) void supabase.removeChannel(ch)
    }
  }, [refreshPendingPurchaseRows])

  /** 아직 시트에서 확인하지 않은 대기 요청만 */
  const unreadPendingIds = useMemo(
    () => pendingRequestIds.filter((id) => !acknowledgedIds.has(id)),
    [pendingRequestIds, acknowledgedIds],
  )
  const unreadPendingCount = unreadPendingIds.length

  /** 첫 fetch 전에는 서버 건수로 뱃지를 보여 주고, 이후에는 미확인 건만 셉니다 */
  const badgeCount = fetchDone ? unreadPendingCount : initialPendingApprovalCount
  const hasParentAlarms = badgeCount > 0

  /** 승인 탭으로 가기 직전: 현재 보이던 대기 건을 모두 「확인」처리 */
  const acknowledgePurchaseNotifications = useCallback(() => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev)
      for (const id of pendingRequestIds) {
        if (!prev.has(id)) next.add(id)
      }
      const pruned = pruneAcknowledgedToCurrentPending(next, pendingRequestIds)
      writeAcknowledgedPurchaseRequestIds(pruned)
      return pruned
    })
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
        onClose={() => setBoardOpen(false)}
        unreadPendingCount={unreadPendingCount}
        onAcknowledgePurchaseNotifications={acknowledgePurchaseNotifications}
      />

      <RoutineAlarmSettingsSheet open={routineOpen} onClose={() => setRoutineOpen(false)} />
    </>
  )
}
