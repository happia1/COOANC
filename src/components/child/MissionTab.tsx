'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type {
  ChildStats,
  DailyMission,
  DailyMissionWithTemplate,
  PraiseStickerGrant,
  PraiseStickerPlacement,
} from '@/types/database'
import MissionCreditCards from '@/components/child/MissionCreditCards'
import ChildMapStickerFloatingStack from '@/components/child/ChildMapStickerFloatingStack'
import { parseSpecialMissionPopup } from '@/lib/specialMissionDescription'
import { isRetiredSpecialMissionTitle, isSpecialSectionMission } from '@/lib/specialMissionChips'
import { compareRoutineFlowSortable, type RoutineFlowSortable } from '@/lib/routineChips'
import { parseAlarmFromMissionDescription } from '@/lib/missionAlarmDescription'
import { scaledMissionRewards, type RewardMultiplier } from '@/lib/missionRewardMultiplier'
import MissionSleepMorningLayer from '@/components/child/MissionSleepMorningLayer'
import SpriteImage from '@/components/common/SpriteImage'
import { BANNERS, ICONS } from '@/constants/sprites'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
import { resolveRoutineMissionPngUrl } from '@/lib/routineMissionThumbnail'
import { ASSETS } from '@/constants/assets'

import MissionCreditToPiggyOverlay from '@/components/child/MissionCreditToPiggyOverlay'
import MissionCreditMoveDialog, {
  MissionCreditActionSheet,
  type CreditTransferApiSuccess,
  type CreditTransferKind,
} from '@/components/child/MissionCreditMoveDialog'
import {
  creditsFloating,
  mergeChildStatsPatch,
  normalizeChildStatsCreditsSplit,
} from '@/lib/childCreditsSplit'
import {
  MISSION_CARD_BUTTON_BASE_CLASSNAME,
  MISSION_CARD_IMAGE_AREA_CLASSNAME,
  MISSION_CARD_IMAGE_TEXT_STACK_CLASSNAME,
  MISSION_CARD_REWARD_ICON_WIDTH_PX,
  MISSION_CARD_REWARD_PILL_BASE_CLASSNAME,
  MISSION_CARD_REWARD_ROW_CLASSNAME,
  MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX,
  MISSION_CARD_SCROLLER_CLASSNAME,
  MISSION_CARD_SUBTITLE_CLASSNAME,
  MISSION_CARD_TEXT_BLOCK_CLASSNAME,
  MISSION_CARD_TITLE_CLASSNAME,
  MISSION_TODAY_BOTTOM_SECTION_CLASSNAME,
  MISSION_TODAY_TITLE_HEADING_CLASSNAME,
  MISSION_TODAY_TITLE_ROW_INNER_CLASSNAME,
  MISSION_TODAY_TITLE_ROW_OUTER_CLASSNAME,
} from '@/lib/missionTodayLayoutSpec'
import MissionHeartRow from '@/components/child/MissionHeartRow'
import { completionRateToHearts } from '@/lib/missionHeartCount'

type Props = {
  childId: string
  /** 항해지도 시트 제목 등 — `mission/page.tsx` 에서 프로필과 동일 규칙으로 전달 */
  childName: string
  initialStats: ChildStats | null
  /** 곰 스티커 시트 초기 데이터(홈과 동일 쿼리) */
  initialPraiseGrants: PraiseStickerGrant[]
  initialPraisePlacements: PraiseStickerPlacement[]
  dailyMissions: DailyMissionWithTemplate[]
  today: string
  isFullRestDay: boolean
}

function cardSubtitle(description: string | null | undefined): string | null {
  if (!description?.trim()) return null
  if (parseSpecialMissionPopup(description).isSpecial) return null
  if (parseAlarmFromMissionDescription(description).alarmFile) return null
  return description
}

/** 일상 미션 한 줄을 부모 루틴 탭과 같은 기준(칩 흐름 + daily_missions.scheduled_time)으로 정렬 키로 바꿉니다 */
function dailyMissionToRoutineFlowSortable(dm: DailyMissionWithTemplate): RoutineFlowSortable | null {
  if (!dm.missions) return null
  return {
    title: dm.missions.title,
    block: dm.missions.block ?? null,
    /** 오늘 행에 붙은 시각이 있으면 우선(템플릿과 다를 수 있음) */
    scheduled_time: dm.scheduled_time ?? null,
  }
}

/**
 * 가로 슬라이더 순서: 일상은 부모 `sortMissionsByRoutineFlow` 와 동일, 스페셜은 시각 오름차순 뒤에 붙임
 * (예전처럼 block 칸막이만 하면 같은 블록 안에서 시간 순이 깨짐)
 */
function orderedMissionsForSlider(list: DailyMissionWithTemplate[]): DailyMissionWithTemplate[] {
  const routineRows = list.filter((dm) => dm.missions && !isSpecialSectionMission(dm.missions))
  const specialRows = list.filter((dm) => dm.missions && isSpecialSectionMission(dm.missions))

  const sortedRoutine = [...routineRows].sort((a, b) => {
    const sa = dailyMissionToRoutineFlowSortable(a)
    const sb = dailyMissionToRoutineFlowSortable(b)
    if (!sa || !sb) return 0
    return compareRoutineFlowSortable(sa, sb)
  })

  const sortedSpecial = [...specialRows].sort((a, b) => {
    const ta = a.scheduled_time
    const tb = b.scheduled_time
    if (!ta && !tb) return (a.missions?.title ?? '').localeCompare(b.missions?.title ?? '', 'ko')
    if (!ta) return 1
    if (!tb) return -1
    const c = ta.localeCompare(tb)
    if (c !== 0) return c
    return (a.missions?.title ?? '').localeCompare(b.missions?.title ?? '', 'ko')
  })

  return [...sortedRoutine, ...sortedSpecial]
}

/** 오전/오후 판별에 쓰는 서울 현재 시각(클라이언트 기준) */
function getSeoulNowParts(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date())
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { hour, minute }
}

/** 현재가 오전인지(00:00~11:59) */
function isMorningInSeoulNow(): boolean {
  return getSeoulNowParts().hour < 12
}

/** 미션 카드가 오후 시간대(afternoon/evening/bedtime 또는 12시 이후 시각)인지 */
function isAfternoonMission(dm: DailyMissionWithTemplate): boolean {
  const block = dm.missions?.block
  if (block === 'afternoon' || block === 'evening' || block === 'bedtime') return true
  if (block === 'morning') return false
  const hhmm = dm.scheduled_time
  if (!hhmm || hhmm.length < 2) return false
  const hour = Number(hhmm.slice(0, 2))
  return Number.isFinite(hour) && hour >= 12
}

/**
 * 부모 「다시하기」 후 서버 롤백이 끝난 뒤 오는 브로드캐스트 페이로드 검사 — 형식이 맞지 않으면 무시합니다.
 */

/** assign-today 브로드캐스트로 온 행 + 템플릿을 자녀 카드 목록 형태로 만듭니다. */
function dailyMissionFromAssignPayload(
  childId: string,
  row: Record<string, unknown> | null | undefined,
  template: DailyMissionWithTemplate['missions'] | null | undefined,
): DailyMissionWithTemplate | null {
  if (!row || !template) return null
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  return {
    id,
    child_id: typeof row.child_id === 'string' ? row.child_id : childId,
    mission_template_id: typeof row.mission_template_id === 'string' ? row.mission_template_id : '',
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : '',
    scheduled_time: (row.scheduled_time as string | null) ?? null,
    routine_type: (row.routine_type as DailyMission['routine_type']) ?? 'weekday',
    is_completed: Boolean(row.is_completed),
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    missions: template,
  }
}

/** 특별 배달 미션 팝업에 넣을 필드만 골라 냅니다(이미 본 적이면 null). */
function trySpecialDeliveryPopupFields(
  dm: DailyMissionWithTemplate,
  todayStr: string,
): {
  dailyMissionId: string
  headline: string
  missionTitle: string
  missionDescription: string | null
  /** 카드 하단과 동일: 배율 적용 후 크레딧 */
  creditReward: number
  /** 카드 하단과 동일: 배율 적용 후 EXP(하트 아이콘으로 표시) */
  expReward: number
  /** 보너스 배율(1이면 UI에서 배너·×N배 숨김) */
  rewardMultiplier: RewardMultiplier
} | null {
  if (typeof window === 'undefined') return null
  const m = dm.missions
  if (!m || !isSpecialSectionMission(m)) return null
  if (isRetiredSpecialMissionTitle(m.title)) return null
  if (m.repeat_type !== 'event') return null
  const { isSpecial } = parseSpecialMissionPopup(m.description)
  if (!isSpecial) return null
  const key = `cooanc_sp_shown_${dm.id}_${todayStr}`
  if (sessionStorage.getItem(key)) return null
  const rw = scaledMissionRewards(m)
  return {
    dailyMissionId: dm.id,
    headline: '특별 미션이 도착했어요!',
    missionTitle: m.title,
    missionDescription: m.description ?? null,
    creditReward: rw.credit,
    expReward: rw.exp,
    rewardMultiplier: rw.mult,
  }
}

function isMissionRolledBackPayload(v: unknown): v is { dailyMissionId: string; title: string } {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.dailyMissionId === 'string' && typeof o.title === 'string'
}

/**
 * 미션 탭
 * - 배경: 탭 루트 전체(상단 크레딧+하단 오늘의 미션)에 공용 배경 한 겹(`ASSETS.layouts.sharedAppBackground` — 로딩 화면과 동일). `main` 패딩 상쇄는 `mission/layout.tsx` 의 풀 블리드 래퍼.
 * - **오늘의 미션** 바깥·제목·카드 줄 **패딩**, 카드 **비율·간격** 모두 `missionTodayLayoutSpec.ts` 픽스. 임의 수정 금지.
 * - 미션 탭 본문은 세로 스크롤로 상단(저금통·돈바구니·지갑 무대)·하단(카드)을 이어서 볼 수 있습니다.
 * - 카드 썸네일: `resolveRoutineMissionPngUrl`(제목 우선) 또는 `routines_01` 아틀라스(`missionRoutineIconFrame`)
 * - 부모 Realtime 「다시 하기」: DB 는 서버에서 이미 되돌아가고, 여기서는 카드만 슬라이더에 다시 보이게 맞춥니다.
 * - 항해지도·스티커 단추: 홈 `HomeTab` 과 **같은 `max-w-sm` 좌표**로 `ChildMapStickerFloatingStack` 에서 노출합니다.
 */
export default function MissionTab({
  childId,
  childName,
  initialStats,
  initialPraiseGrants,
  initialPraisePlacements,
  dailyMissions,
  today,
  isFullRestDay,
}: Props) {
  const [stats, setStats] = useState<ChildStats | null>(initialStats)
  /** 지갑·저금통·돈바구니(가용) 옮기기: 먼저 어떤 통을 눌렀는지(시트) → 종류 선택 후 수량 팝업 */
  const [creditSheetBucket, setCreditSheetBucket] = useState<'center' | 'wallet' | 'piggy' | null>(null)
  const [creditMoveKind, setCreditMoveKind] = useState<CreditTransferKind | null>(null)

  const [done, setDone] = useState<Set<string>>(
    new Set(dailyMissions.filter((dm) => dm.is_completed).map((dm) => dm.id)),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [specialPopup, setSpecialPopup] = useState<{
    dailyMissionId: string
    headline: string
    missionTitle: string
    /** 카드 썸네일과 같은 그림을 쓰기 위해 미션 템플릿 설명(JSON 포함)을 보관합니다. */
    missionDescription: string | null
    /** 완료 보상 — 카드와 같은 규칙(배율 적용) */
    creditReward: number
    expReward: number
    /** 2·3배 보너스일 때 배너 스프라이트와 함께 표시 */
    rewardMultiplier: RewardMultiplier
  } | null>(null)

  /** 하트 5개 채움 축하 팝업 (하루 1회) */
  const [heartsFullPopup, setHeartsFullPopup] = useState(false)
  /** 오전에 오후 미션을 눌렀을 때 띄우는 안내 팝업 */
  const [truthPopupOpen, setTruthPopupOpen] = useState(false)

  const router = useRouter()
  /** 부모가 오늘 일정을 넣은 뒤 날짜 비교에 쓰는 최신 today 문자열 */
  const todayRef = useRef(today)
  todayRef.current = today

  /** 자정 00:00:00 에 router.refresh() — 하트·완료 집합을 새 날짜 기준으로 리셋합니다 */
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const msUntilMidnight = midnight.getTime() - now.getTime()
    const timer = setTimeout(() => { router.refresh() }, msUntilMidnight)
    return () => clearTimeout(timer)
  }, [router])

  /**
   * 서버 props 와 동기화하되, 부모 assign 브로드캐스트로 행이 먼저 오면 여기에 합쳐 즉시 카드·팝업을 맞춥니다.
   */
  const [missionList, setMissionList] = useState<DailyMissionWithTemplate[]>(dailyMissions)
  useEffect(() => {
    setMissionList(dailyMissions)
  }, [dailyMissions])

  /** 부모 「다시하기」로 미션이 되돌아갔을 때 띄우는 알림 팝업(토스트와 별도) */
  const [rollbackPopup, setRollbackPopup] = useState<{
    dailyMissionId: string
    missionTitle: string
  } | null>(null)

  /**
   * 브로드캐스트·DB 실시간 둘 다 올 때 팝업이 두 번 뜨지 않게, 같은 일일 미션 id 는 잠깐 동안 한 번만 안내합니다.
   * 키: dailyMissionId, 값: 표시한 시각(ms)
   */
  const rollbackPopupDedupRef = useRef<Map<string, number>>(new Map())

  /** 이미 SUBSCRIBED 인 채널에 바로 send — 매번 subscribe 하지 않아 부모 목록 갱신이 빨라집니다 */
  const parentLogBroadcastRef = useRef<RealtimeChannel | null>(null)

  /** 미션 완료 시 돼지 저금통 위 크레딧 낙하 연출(토큰 증가 = 다시 재생) */
  const [creditFxNonce, setCreditFxNonce] = useState(0)
  const [creditFxOn, setCreditFxOn] = useState(false)
  /** 카드 클릭 지점(뷰포트 좌표) — 동전이 카드에서 시작하도록 사용 */
  const [creditFxStart, setCreditFxStart] = useState<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 180,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.72 : 520,
  })
  const endCreditFx = useCallback(() => setCreditFxOn(false), [])

  /**
   * 폐지된 스페셜 템플릿(설거지·방청소·심부름 등)은 오늘 행이 남아 있어도 슬라이더·달성 수에 넣지 않음
   * (부모 루틴 탭과 동일 제목 집합 — `isRetiredSpecialMissionTitle`)
   */
  const visibleMissionList = useMemo(
    () =>
      missionList.filter((dm) => {
        const m = dm.missions
        if (!m) return true
        if (!isSpecialSectionMission(m)) return true
        return !isRetiredSpecialMissionTitle(m.title)
      }),
    [missionList],
  )

  const ordered = useMemo(() => orderedMissionsForSlider(visibleMissionList), [visibleMissionList])

  /** 완료한 카드는 가로 슬라이더에서 제거해 바로 「사라진」 느낌을 줍니다 */
  const incompleteOrdered = useMemo(() => ordered.filter((dm) => !done.has(dm.id)), [ordered, done])

  useEffect(() => {
    setStats(initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null)
  }, [initialStats])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`child_stats_mission:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'child_stats',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          setStats((prev) =>
            normalizeChildStatsCreditsSplit(
              mergeChildStatsPatch(prev, payload.new as Record<string, unknown>),
            ),
          )
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId])

  /** 부모 앱과 같은 채널 이름으로 브로드캐스트를 구독해 「다시하기」 알림을 받습니다 */
  useEffect(() => {
    const supabase = createClient()
    const refreshCh = supabase.channel(`parent_mission_log_refresh:${childId}`, {
      config: { broadcast: { ack: false } },
    })
    refreshCh.subscribe((status) => {
      if (status === 'SUBSCRIBED') parentLogBroadcastRef.current = refreshCh
    })
    return () => {
      parentLogBroadcastRef.current = null
      void supabase.removeChannel(refreshCh)
    }
  }, [childId])

  /**
   * 부모가 assign-today 등으로 오늘 daily_missions 행을 넣으면, 서버 컴포넌트 props 는 그대로라
   * 특별 미션 팝업이 안 뜰 수 있습니다. INSERT·부모 브로드캐스트 시 오늘 날짜면 RSC 를 다시 받아옵니다(브로드캐스트 페이로드로는 이미 낙관적 반영).
   */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`daily_missions_child_refresh:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_missions',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          const row = payload.new as { date?: string }
          const d = typeof row.date === 'string' ? row.date.slice(0, 10) : ''
          if (d === todayRef.current) router.refresh()
        },
      )
      .on('broadcast', { event: 'assign_today_ok' }, (msg) => {
        type P = {
          date?: string
          alreadyAssigned?: boolean
          dailyMission?: Record<string, unknown> | null
          missionTemplate?: DailyMissionWithTemplate['missions'] | null
        }
        const p = (msg as { payload?: P }).payload
        const d = typeof p?.date === 'string' ? p.date.slice(0, 10) : ''
        const shouldRefresh = !d || d === todayRef.current
        if (shouldRefresh && p && !p.alreadyAssigned && p.dailyMission && p.missionTemplate) {
          const optimisticDm = dailyMissionFromAssignPayload(childId, p.dailyMission, p.missionTemplate)
          if (optimisticDm) {
            setMissionList((prev) =>
              prev.some((x) => x.id === optimisticDm.id) ? prev : [...prev, optimisticDm],
            )
            const fields = trySpecialDeliveryPopupFields(optimisticDm, todayRef.current)
            if (fields) setSpecialPopup(fields)
          }
        }
        if (shouldRefresh) router.refresh()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId, router])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  /**
   * 크레딧 옮기기 API 성공 직후: Supabase Realtime 은 늦게 올 수 있어, 응답 본문으로 `stats` 를 바로 맞춥니다.
   * (이전에는 `onSuccess` 가 비어 있어 화면이 갱신되지 않거나 한참 뒤에야 바뀌는 것처럼 보였습니다.)
   */
  const applyCreditTransferSuccess = useCallback((result: CreditTransferApiSuccess) => {
    setStats((prev) =>
      normalizeChildStatsCreditsSplit(
        mergeChildStatsPatch(prev, {
          credits: result.credits,
          credits_wallet: result.credits_wallet,
          credits_piggy: result.credits_piggy,
        }),
      ),
    )
    setCreditSheetBucket(null)
  }, [])

  /**
   * 롤백 알림 팝업을 한 번만 띄웁니다(실시간·브로드캐스트 중복 방지).
   */
  const tryShowRollbackPopup = useCallback((dailyMissionId: string, missionTitle: string) => {
    const now = Date.now()
    const m = rollbackPopupDedupRef.current
    for (const [id, t] of m) {
      if (now - t > 8000) m.delete(id)
    }
    if (m.has(dailyMissionId)) return
    m.set(dailyMissionId, now)
    setRollbackPopup({ dailyMissionId, missionTitle })
  }, [])

  /**
   * 부모 「다시하기」 직후: 슬라이더 완료 집합을 풀고, 팝업으로 롤백 사실을 알립니다.
   */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`mission_redo:${childId}`)
      .on('broadcast', { event: 'mission_rolled_back' }, (message) => {
        const raw = (message as { payload?: unknown }).payload
        if (!isMissionRolledBackPayload(raw)) return
        setDone((prev) => {
          const next = new Set(prev)
          next.delete(raw.dailyMissionId)
          return next
        })
        tryShowRollbackPopup(raw.dailyMissionId, raw.title)
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId, tryShowRollbackPopup])

  /**
   * 브로드캐스트가 끊겨도 mission_logs 가 미완료로 바뀌는 순간 DB 와 슬라이더를 맞춥니다(Realtime 공개 테이블).
   * 브로드캐스트를 못 받은 경우에만 여기서 제목을 조회해 같은 롤백 팝업을 띄웁니다.
   */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`mission_log_undo_sync:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mission_logs',
          filter: `child_id=eq.${childId}`,
        },
        async (payload) => {
          const row = payload.new as {
            is_completed?: boolean
            mission_id?: string
            assigned_date?: string
          }
          if (row.is_completed !== false) return
          const mid = row.mission_id
          const ad =
            typeof row.assigned_date === 'string'
              ? row.assigned_date.slice(0, 10)
              : String(row.assigned_date ?? '')
          if (!mid || !ad) return
          const { data: dm } = await supabase
            .from('daily_missions')
            .select('id, is_completed')
            .eq('child_id', childId)
            .eq('mission_template_id', mid)
            .eq('date', ad)
            .maybeSingle()
          if (dm && dm.is_completed === false) {
            setDone((prev) => {
              const next = new Set(prev)
              next.delete(dm.id)
              return next
            })
            const { data: mt } = await supabase.from('missions').select('title').eq('id', mid).maybeSingle()
            tryShowRollbackPopup(dm.id, typeof mt?.title === 'string' && mt.title.trim() ? mt.title : '미션')
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId, tryShowRollbackPopup])

  useEffect(() => {
    if (typeof window === 'undefined') return
    for (const dm of visibleMissionList) {
      const m = dm.missions
      if (!m || !isSpecialSectionMission(m)) continue
      const { isSpecial } = parseSpecialMissionPopup(m.description)
      if (m.repeat_type !== 'event') continue
      if (!isSpecial) continue
      const key = `cooanc_sp_shown_${dm.id}_${today}`
      if (sessionStorage.getItem(key)) continue
      const rw = scaledMissionRewards(m)
      setSpecialPopup({
        dailyMissionId: dm.id,
        headline: '특별 미션이 도착했어요!',
        missionTitle: m.title,
        missionDescription: m.description ?? null,
        creditReward: rw.credit,
        expReward: rw.exp,
        rewardMultiplier: rw.mult,
      })
      break
    }
  }, [visibleMissionList, today])

  function dismissSpecialPopup() {
    if (specialPopup && typeof window !== 'undefined') {
      sessionStorage.setItem(`cooanc_sp_shown_${specialPopup.dailyMissionId}_${today}`, '1')
    }
    setSpecialPopup(null)
  }

  function dismissRollbackPopup() {
    setRollbackPopup(null)
  }

  function handleComplete(dm: DailyMissionWithTemplate, ev: MouseEvent<HTMLButtonElement>) {
    if (done.has(dm.id)) return
    /**
     * 오전에는 오후 시간대 미션 완료를 막습니다.
     * 단, 스페셜 미션은 오전/오후 구분 없이 수행 가능해야 하므로 차단 대상에서 제외합니다.
     * 사용자가 카드 여러 장을 빠르게 눌러도 이 조건을 먼저 검사해 API 호출 전에 차단합니다.
     */
    if (isMorningInSeoulNow() && isAfternoonMission(dm) && !isSpecialSectionMission(dm.missions)) {
      setTruthPopupOpen(true)
      return
    }

    if (!isFullRestDay) {
      /**
       * 사용자가 누른 카드 중심 좌표를 시작점으로 저장해,
       * 동전이 "카드에서 출발해 상단 크레딧으로 이동"하는 것처럼 보이게 합니다.
       */
      const rect = ev.currentTarget.getBoundingClientRect()
      setCreditFxStart({
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      })
      setCreditFxNonce((n) => n + 1)
      setCreditFxOn(true)
    }

    /** 낙관적: API 기다리지 않고 카드 제거(슬라이더에서 숨김). 콘페티는 전부 완료될 때만 별도 레이어에서 연출 */
    setDone((prev) => new Set([...prev, dm.id]))

    void (async () => {
      try {
        const res = await fetch('/api/daily-mission/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyMissionId: dm.id, today, childId }),
        })
        const text = await res.text()
        let json: Record<string, unknown> = {}
        let parseErr: string | null = null
        try {
          json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
        } catch (pe) {
          parseErr = String(pe)
        }
        if (parseErr || !res.ok) {
          setDone((prev) => {
            const next = new Set(prev)
            next.delete(dm.id)
            return next
          })
          showToast(typeof json.error === 'string' ? json.error : '미션 완료에 실패했어요')
          return
        }
        const ch = parentLogBroadcastRef.current
        if (ch) {
          void ch.send({ type: 'broadcast', event: 'child_completed_mission', payload: { t: Date.now() } })
        }
      } catch {
        setDone((prev) => {
          const next = new Set(prev)
          next.delete(dm.id)
          return next
        })
        showToast('네트워크 오류가 발생했어요')
      }
    })()
  }

  const stNorm = stats ? normalizeChildStatsCreditsSplit(stats) : null
  const walletCredits = stNorm?.credits_wallet ?? 0
  const piggyCredits = stNorm?.credits_piggy ?? 0
  const floatingCredits = stNorm ? creditsFloating(stNorm) : 0

  const completedCount = useMemo(
    () => visibleMissionList.filter((dm) => done.has(dm.id)).length,
    [visibleMissionList, done],
  )
  const total = visibleMissionList.length
  const filledHearts = completionRateToHearts(completedCount, total)

  function handleHeartsFull() {
    if (typeof window === 'undefined') return
    const key = `cooanc_hearts_full_${childId}_${today}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setHeartsFullPopup(true)
  }

  /** 크레딧 옮기기 팝업 제목만(본문 힌트는 레이아웃·겹침 이슈로 팝업에서 제거함) */
  const transferCopy: Record<CreditTransferKind, { title: string }> = {
    float_to_wallet: { title: '지갑으로 옮기기' },
    float_to_piggy: { title: '저금통으로 옮기기' },
    wallet_to_float: { title: '돈바구니로 꺼내기' },
    piggy_to_float: { title: '돈바구니로 꺼내기' },
    wallet_to_piggy: { title: '저금통으로 옮기기' },
    piggy_to_wallet: { title: '지갑으로 옮기기' },
  }

  function maxAmountForKind(kind: CreditTransferKind): number {
    switch (kind) {
      case 'float_to_wallet':
      case 'float_to_piggy':
        return floatingCredits
      case 'wallet_to_float':
      case 'wallet_to_piggy':
        return walletCredits
      case 'piggy_to_float':
      case 'piggy_to_wallet':
        return piggyCredits
      default:
        return 0
    }
  }

  /**
   * 카드 바로 위 **한 행**: 「오늘의 미션」은 왼쪽, 완료율 EXP 하트 5개는 같은 줄 **오른쪽**에 둡니다.
   * (비개발자용) 가로가 넓으면 제목과 하트 사이에 빈 공간이 생기고, 제목이 길면 말줄임으로 하트와 겹치지 않습니다.
   * 레이아웃·간격은 `missionTodayLayoutSpec.ts` 고정값을 씁니다.
   */
  const missionTitleAboveCards = (
    <div className={MISSION_TODAY_TITLE_ROW_OUTER_CLASSNAME}>
      <div className={MISSION_TODAY_TITLE_ROW_INNER_CLASSNAME}>
        <h2 className={MISSION_TODAY_TITLE_HEADING_CLASSNAME}>오늘의 미션</h2>
        <MissionHeartRow filledCount={filledHearts} onFull={handleHeartsFull} />
      </div>
    </div>
  )

  /**
   * 상단 크레딧 카드만 보여 줍니다.
   * 세로로 `flex-[3]` 빈칸 + 카드 + `flex-1` 빈칸 → 남는 높이를 **3:1**로 나눔.
   * (비개발자용) 중앙(`1:1`)과 맨 아래 붙임(`전부 위`)의 **가운데**쯤, 즉 “절반만” 아래로 내린 위치와 같습니다.
   * `pb-1 sm:pb-1.5`: 하단 경계와 살짝 간격. 하단 `bottomPanel` 스펙은 그대로입니다.
   */
  const heroBand = (
    <div className="relative flex min-h-0 w-full flex-[5.5] basis-0 flex-col self-stretch pb-1 sm:pb-1.5">
      {/** 장식용 여백 — 스크린 리더에 읽히지 않게 숨김 */}
      <div className="min-h-0 shrink-0 flex-[3]" aria-hidden />
      {/** `max-w-sm` 보다 좁게 — 세 칸 카드 가로를 줄이고 양옆에 배경이 조금 더 보이게 */}
      {/** `z-0`: 제목·하트(`z-[30]`)가 위로 겹칠 때 저금통 줄보다 뒤에 두어 글이 가려지지 않게 함 */}
      <div className="relative z-0 flex w-full shrink-0 justify-center px-3 sm:px-4">
        <div className="w-full max-w-[18rem] sm:max-w-[18.5rem]">
          <MissionCreditCards
            piggy={piggyCredits}
            floating={floatingCredits}
            wallet={walletCredits}
            onPiggyTap={() => setCreditSheetBucket('piggy')}
            onCenterTap={() => { if (floatingCredits > 0) setCreditSheetBucket('center') }}
            onWalletTap={() => setCreditSheetBucket('wallet')}
          />
        </div>
      </div>
      <div className="min-h-0 shrink-0 flex-1" aria-hidden />
    </div>
  )

  /**
   * 하단 「오늘의 미션」 블록 — 패딩·카드 비율·간격은 `missionTodayLayoutSpec.ts` 픽스(상단 스펙 목록).
   * 제목·하트는 **스크롤 밖**에 두고, 그 아래만 `overflow-y-auto` 해 `-mt` 로 위로 올린 제목이 잘리지 않게 합니다.
   */
  const bottomPanel = (
    <section className={MISSION_TODAY_BOTTOM_SECTION_CLASSNAME} aria-label="오늘의 미션 카드">
      {missionTitleAboveCards}
      {/**
       * 세로 스크롤은 이 안만 — 제목은 밖에 두고, `pt-2` 로 카드 행만 아래로 살짝 내림.
       */}
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
      {ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <p className="font-bold text-brand-text">아직 미션이 없어요</p>
          <p className="text-sm text-gray-400">부모님이 미션을 만들어주실 거예요!</p>
        </div>
      ) : incompleteOrdered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-6 text-center">
          <p className="text-sm font-bold text-gray-500">오늘의 미션을 모두 완료했어요</p>
        </div>
      ) : (
        <>
          {/**
           * `-mx-1` 제거: 부모 `overflow-hidden` 과 만나 첫 카드 **왼쪽 테두리**가 잘림.
           * `overflow-auto`: 세로가 모자라면 이 영역만 스크롤(카드 `min-h` 도 낮춤).
           */}
          {/**
           * `items-start`: `stretch` 는 카드 세로 늘림(비율 깨짐), `center` 는 남는 `flex-1` 높이 안에서
           * 카드를 가운데 두어 「오늘의 미션」과 멀어지고 독바에만 가깝게 보입니다.
           */}
          {/**
           * `overflow-y-hidden` 은 카드가 행 높이보다 조금만 커도 위·아래가 잘려(특히 아이콘 상단) 보입니다.
           * 가로만 스크롤 — 세로는 카드 본문 높이를 맞춰 잘리지 않게 합니다.
           */}
          {/**
           * `flex-1` 이면 패널 세로가 부족할 때 이 행 높이만 줄어들고, 카드보다 짧아져 하단이 잘릴 수 있음.
           * `flex-none` 으로 카드 실제 높이만큼만 쓰고, 부족하면 위쪽 **제목 아래** `overflow-y-auto` 래퍼에서만 세로 스크롤합니다.
           */}
          <div
            className={MISSION_CARD_SCROLLER_CLASSNAME}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
          {incompleteOrdered.map((dm) => {
            const m = dm.missions
            if (!m) return null
            const rewards = scaledMissionRewards(m)
            const special = isSpecialSectionMission(m)
            const sub = cardSubtitle(m.description)
            const routineFrame = missionRoutineIconFrame(m.title, m.description)
            const routineImagePath = resolveRoutineMissionPngUrl({ title: m.title, iconEmoji: m.icon_emoji })
            return (
              <button
                key={dm.id}
                type="button"
                onClick={(ev) => handleComplete(dm, ev)}
                aria-label={`${m.title} 미션 완료하기`}
                className={[
                  MISSION_CARD_BUTTON_BASE_CLASSNAME,
                  special
                    ? 'border-amber-300 ring-2 ring-amber-200/60 bg-gradient-to-b from-amber-50 via-amber-100 to-yellow-200'
                    : 'border-gray-200/90',
                ].join(' ')}
              >
                {/**
                 * 카드 전체 탭 = 완료. 일반 미션은 흰 카드, 특별만 앰버 테두리.
                 * `routines_01.png` 아틀라스 — `clipRotated={false}` 로 회전 프레임 잘림 완화.
                 */}
                {/** 배경색 없음 — 아틀라스 일러스트만 흰 카드 위에 표시 */}
                {/**
                 * 그림과 제목 사이는 스택에서 gap-y-0 으로 거의 붙이고, 제목 블록 ↔ 보상 줄은 버튼 gap-y-1.5 유지.
                 * 일러스트 픽셀·영역 높이·카드 최소 크기는 `missionTodayLayoutSpec.ts` 에서 조정합니다.
                 */}
                <div className={MISSION_CARD_IMAGE_TEXT_STACK_CLASSNAME}>
                  {/**
                   * `min-h` + 세로 중앙: 짧은 카드에서도 루틴 일러스트가 잘리지 않게(이전 `flex-1`+낮은 `aspect` 조합이 상단 클리핑 유발).
                   */}
                  <div className={MISSION_CARD_IMAGE_AREA_CLASSNAME}>
                    {routineImagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- public 정적 경로, 미션 카드 이미지 직접 표시
                      <img
                        src={routineImagePath}
                        alt=""
                        className="select-none object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                        style={{ width: MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX, height: MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX }}
                        draggable={false}
                      />
                    ) : (
                      <SpriteImage
                        sheet={MISSION_ROUTINES_ATLAS}
                        frame={routineFrame}
                        width={MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX}
                        clipRotated={false}
                        className="select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                      />
                    )}
                  </div>

                  <div className={MISSION_CARD_TEXT_BLOCK_CLASSNAME}>
                    <p className={MISSION_CARD_TITLE_CLASSNAME}>{m.title}</p>
                    {sub ? (
                      <p className={MISSION_CARD_SUBTITLE_CLASSNAME}>{sub}</p>
                    ) : null}
                  </div>
                </div>

                {/**
                 * 보상 줄: 실제 파일은 `public/assets/img/common/ui/icons.png` 이고,
                 * 여기서는 `ICONS` 상수로 같은 PNG를 가리킵니다(`/assets/img/common/ui/icons.png`).
                 * 시안과 동일하게 한 줄: [크레딧 아이콘+숫자] [하트 아이콘+숫자] — 오른쪽은 EXP(텍스트 없이 하트로 표현).
                 */}
                <div className={MISSION_CARD_REWARD_ROW_CLASSNAME}>
                  <div
                    className={[
                      MISSION_CARD_REWARD_PILL_BASE_CLASSNAME,
                      special ? 'bg-amber-100/90' : 'bg-stone-100/95',
                    ].join(' ')}
                    role="group"
                    aria-label={`미션 보상: 크레딧 ${rewards.credit}, 경험치 ${rewards.exp}`}
                  >
                    {/** 왼쪽: 크레딧(동전) */}
                    <span className="inline-flex items-center gap-[1px]">
                      <SpriteImage
                        sheet={ICONS}
                        frame="credit"
                        width={MISSION_CARD_REWARD_ICON_WIDTH_PX}
                        clipRotated={false}
                        className="shrink-0 select-none"
                      />
                      <span>{rewards.credit}</span>
                    </span>
                    {/** 오른쪽: 경험치 — 하트 그림이 EXP를 뜻함 */}
                    <span className="inline-flex items-center gap-[1px]" title="경험치(EXP)">
                      <SpriteImage
                        sheet={ICONS}
                        frame="heart"
                        width={MISSION_CARD_REWARD_ICON_WIDTH_PX}
                        className="shrink-0 select-none"
                      />
                      <span>{rewards.exp}</span>
                    </span>
                  </div>
                </div>
                {/**
                 * 위 알약에 이미 배율이 곱해진 크레딧·EXP가 나오므로 「보상 N배」 중복 문구는 넣지 않습니다.
                 */}
              </button>
            )
          })}
          </div>
        </>
      )}
      </div>
    </section>
  )

  const popupBlock = specialPopup ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sp-pop-title"
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="닫기" onClick={dismissSpecialPopup} />
      <div className="relative z-[1] max-h-[min(85dvh,calc(100vh-2rem))] w-full max-w-sm overflow-y-auto rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-50 via-yellow-50 to-amber-100 p-5 shadow-xl shadow-amber-200/40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p id="sp-pop-title" className="text-center text-lg font-black text-amber-900">
          {specialPopup.headline}
        </p>
        {/**
         * 특별 미션 카드와 같은 아틀라스 프레임으로 그림을 보여 줍니다(제목·설명 키워드 기반).
         */}
        <div className="mt-3 flex justify-center">
          <SpriteImage
            sheet={MISSION_ROUTINES_ATLAS}
            frame={missionRoutineIconFrame(specialPopup.missionTitle, specialPopup.missionDescription)}
            width={88}
            clipRotated={false}
            className="select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          />
        </div>
        <p className="mt-2 text-center text-sm font-bold text-amber-800">{specialPopup.missionTitle}</p>
        {/**
         * 보너스(2·3배)일 때 분홍 뾰족 배지 위에 xN배 텍스트를 얹어 보여 줍니다.
         * 미션 카드 하단과 같은 아이콘: 크레딧 · 경험치(EXP는 하트 스프라이트).
         */}
        <div className="mt-4 flex items-center justify-center px-1">
          {/**
           * 배율 배지(분홍 뾰족 원)는 보상 알약의 우상단 모서리에 "걸쳐" 보여야 해서
           * 알약 래퍼를 relative 로 두고 배지를 absolute 로 겹쳐 배치합니다.
           */}
          <div className="relative inline-block">
            <div
              className="inline-flex max-w-full flex-nowrap items-center justify-center gap-x-2 rounded-full px-3 py-2 text-sm font-black tabular-nums tracking-tight text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06] bg-amber-100/90"
              role="group"
              aria-label={
                specialPopup.rewardMultiplier > 1
                  ? `보너스 ${specialPopup.rewardMultiplier}배, 크레딧 ${specialPopup.creditReward}, 경험치 ${specialPopup.expReward}`
                  : `미션 보상: 크레딧 ${specialPopup.creditReward}, 경험치 ${specialPopup.expReward}`
              }
            >
              <span className="inline-flex items-center gap-1">
                <SpriteImage
                  sheet={ICONS}
                  frame="credit"
                  width={18}
                  clipRotated={false}
                  className="shrink-0 select-none"
                />
                <span>{specialPopup.creditReward}</span>
              </span>
              <span className="inline-flex items-center gap-1" title="경험치(EXP)">
                <SpriteImage sheet={ICONS} frame="heart" width={18} className="shrink-0 select-none" />
                <span>{specialPopup.expReward}</span>
              </span>
            </div>
            {specialPopup.rewardMultiplier > 1 ? (
              <div className="pointer-events-none absolute -right-10 -top-4 z-[2] h-12 w-12">
                <SpriteImage
                  sheet={BANNERS}
                  frame="special"
                  width={42}
                  clipRotated={false}
                  className="absolute inset-0 m-auto shrink-0 select-none drop-shadow-sm"
                />
                {/** 텍스트를 배지 박스 정중앙에 고정하고, 가독성을 위해 흰색으로 표시 */}
                <span className="absolute inset-0 flex -translate-x-[3.5px] -translate-y-[1px] items-center justify-center text-[13px] font-black tabular-nums leading-none text-white">
                  x{specialPopup.rewardMultiplier}
                  {/** 요청사항: '배' 글자만 절반 크기로 축소 */}
                  <span className="text-[0.6em]">배</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={dismissSpecialPopup}
          className="mt-5 w-full rounded-xl bg-brand-blue py-3 text-sm font-bold text-white"
        >
          확인했어요
        </button>
      </div>
    </div>
  ) : null

  /** 오전에 오후 미션을 눌렀을 때 보여 주는 경고 팝업 */
  const truthPopupBlock = truthPopupOpen ? (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="truth-pop-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="닫기"
        onClick={() => setTruthPopupOpen(false)}
      />
      <div className="relative z-[1] w-full max-w-xs rounded-2xl bg-white p-4 shadow-2xl">
        <p id="truth-pop-title" className="text-center text-lg font-black text-brand-text">
          거짓말은 안돼!
        </p>
        <div className="mt-3 flex justify-center">
          {/** 요청 이미지 경로: public/assets/img/missions/routine/dont.png */}
          {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 경로 팝업 이미지 직접 표시 */}
          <img
            src="/assets/img/missions/routine/dont.png"
            alt="거짓말은 안돼 경고 이미지"
            className="h-auto w-40 select-none object-contain"
            draggable={false}
          />
        </div>
        <button
          type="button"
          onClick={() => setTruthPopupOpen(false)}
          className="mt-4 w-full rounded-xl bg-brand-blue py-3 text-sm font-bold text-white"
        >
          알겠어요
        </button>
      </div>
    </div>
  ) : null

  /**
   * 롤백된 미션의 카드 일러스트를 같은 규칙으로 계산합니다.
   * - dailyMissionId 로 오늘 카드 목록에서 찾기
   * - 못 찾으면 payload 의 missionTitle 로 안전하게 계산
   */
  const rollbackMissionIconFrame = rollbackPopup
    ? (() => {
        const matched = ordered.find((dm) => dm.id === rollbackPopup.dailyMissionId)?.missions
        const title = matched?.title ?? rollbackPopup.missionTitle
        const description = matched?.description ?? null
        return missionRoutineIconFrame(title, description)
      })()
    : null

  /** 미션 롤백 안내 — 특별 미션 팝업보다 위에 두어 부모 알림이 가려지지 않게 합니다 */
  const rollbackPopupBlock = rollbackPopup ? (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollback-pop-title"
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="닫기" onClick={dismissRollbackPopup} />
      <div className="relative z-[1] w-full max-w-sm rounded-2xl border-2 border-orange-300 bg-white p-5 shadow-xl">
        <p id="rollback-pop-title" className="text-center text-lg font-black text-brand-text">
          미션 다시하기
        </p>
        <div className="mt-3 flex justify-center">
          <SpriteImage
            sheet={MISSION_ROUTINES_ATLAS}
            frame={rollbackMissionIconFrame ?? missionRoutineIconFrame(rollbackPopup.missionTitle, null)}
            width={92}
            clipRotated={false}
            className="select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          />
        </div>
        <p className="mt-2 text-center text-sm font-bold text-orange-600">{rollbackPopup.missionTitle}</p>
        <p className="mt-3 text-center text-xs font-medium leading-relaxed text-gray-600">
          사유: 부모님이 이 미션을 다시 하기로 바꿨어요.
        </p>
        <button
          type="button"
          onClick={dismissRollbackPopup}
          className="mt-5 w-full rounded-xl bg-brand-blue py-3 text-sm font-bold text-white"
        >
          알겠어요
        </button>
      </div>
    </div>
  ) : null

  /**
   * 가로·상단 패딩 상쇄는 `(child)/mission/layout.tsx` 한 곳에서만 처리합니다.
   * 여기서는 하단 독과 겹치지 않도록 아래쪽 마진만 둡니다.
   */
  const missionTabRootClassName =
    'relative isolate box-border -mb-[calc(60px+0.35rem)] flex min-h-0 min-w-0 flex-1 flex-col bg-transparent'

  /**
   * 미션 화면 맨 뒤 풀블리드 배경입니다.
   * 비개발자 설명: `mission/layout.tsx` 가 좌우·위로 넓혀 주므로, 이 그림이 탭 가장자리까지 보입니다.
   * `pointer-events-none`: 배경이 버튼·카드의 터치를 가리지 않습니다.
   */
  const missionAreaBackground = (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <Image
        src={ASSETS.layouts.missionTabBackground}
        alt=""
        fill
        className="object-cover object-[center_88%]"
        sizes="100vw"
      />
    </div>
  )

  if (isFullRestDay) {
    return (
      <div className={missionTabRootClassName}>
        {missionAreaBackground}
        <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
          <MissionSleepMorningLayer
            childId={childId}
            today={today}
            isFullRestDay={isFullRestDay}
            completedCount={completedCount}
            totalMissions={total}
          />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
            <ChildMapStickerFloatingStack
              childId={childId}
              childName={childName}
              stats={stats}
              setStats={setStats}
              initialPraiseGrants={initialPraiseGrants}
              initialPraisePlacements={initialPraisePlacements}
            />
            {heroBand}
            {/** `-mt-2`: 상단 크레딧 칸(5.5)은 그대로 두고, 이 하단 칸만 살짝 위로 당겨 간격을 줄임 */}
            <div className="-mt-2 flex min-h-0 min-w-0 flex-[4.5] basis-0 flex-col items-center justify-center gap-2 overflow-x-hidden overflow-y-hidden overscroll-contain px-4 py-2 text-center sm:gap-3 sm:px-6 sm:py-4">
              <span className="text-sm font-black text-gray-400">휴식</span>
              <p className="text-lg font-black text-brand-text sm:text-xl">오늘은 쉬는 날이에요!</p>
              <p className="text-xs text-gray-400 sm:text-sm">푹 쉬고 내일 또 열심히 해봐요.</p>
            </div>
          </div>
          {popupBlock}
          {rollbackPopupBlock}
          {truthPopupBlock}
        </div>

        <MissionCreditActionSheet
          open={creditSheetBucket !== null}
          onClose={() => setCreditSheetBucket(null)}
          bucket={creditSheetBucket ?? 'center'}
          floating={floatingCredits}
          wallet={walletCredits}
          piggy={piggyCredits}
          onPick={(kind) => setCreditMoveKind(kind)}
        />

        <MissionCreditMoveDialog
          open={creditMoveKind !== null}
          onClose={() => setCreditMoveKind(null)}
          childId={childId}
          kind={creditMoveKind}
          maxAmount={creditMoveKind ? maxAmountForKind(creditMoveKind) : 0}
          title={creditMoveKind ? transferCopy[creditMoveKind].title : ''}
          piggyBalance={piggyCredits}
          walletBalance={walletCredits}
          onSuccess={applyCreditTransferSuccess}
        />
      </div>
    )
  }

  return (
    <div className={missionTabRootClassName}>
      {missionAreaBackground}
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <MissionSleepMorningLayer
          childId={childId}
          today={today}
          isFullRestDay={isFullRestDay}
          completedCount={completedCount}
          totalMissions={total}
        />
        {popupBlock}
        {rollbackPopupBlock}
        {truthPopupBlock}
        {/**
         * 토스트는 `main`(z-10) 안에 두면 상단바(z-40)·하단 독(z-50)보다 뒤 레이어라 가려집니다.
         * `document.body`로 포털을 열고 화면 정중앙에 두어 항상 위에 보이게 합니다.
         * 바깥은 `pointer-events-none` — 짧은 표시 동안에도 탭은 아래로 통과합니다.
         */}
        {toast &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center px-5 pointer-events-none"
              role="status"
              aria-live="polite"
            >
              <div className="max-w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl bg-brand-blue px-5 py-3 text-center text-sm font-bold leading-snug text-white shadow-2xl ring-2 ring-white/25 pointer-events-auto">
                {toast}
              </div>
            </div>,
            document.body,
          )}
        {creditFxOn ? (
          <MissionCreditToPiggyOverlay
            playId={creditFxNonce}
            onFinish={endCreditFx}
            startX={creditFxStart.x}
            startY={creditFxStart.y}
          />
        ) : null}
        {/**
         * `overflow-y-hidden`: flex `min-h-0` 축소가 깨지지 않게 해 한 화면에 맞춤(`overflow-y-visible` 이면 세로 스크롤바 유발).
         * 카드만 필요 시 스크롤 — `bottomPanel` 안 래퍼에 `overflow-y-auto` + 스크롤바 숨김.
         */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
          <ChildMapStickerFloatingStack
            childId={childId}
            childName={childName}
            stats={stats}
            setStats={setStats}
            initialPraiseGrants={initialPraiseGrants}
            initialPraisePlacements={initialPraisePlacements}
          />
          {heroBand}
          {/** `z-20` + 세로 visible: 제목이 위로 나와도 잘리지 않고, 상단 크레딧(z-0)보다 앞에 그려짐 */}
          <div className="relative z-20 -mt-2 flex min-h-0 min-w-0 flex-[4.5] basis-0 flex-col overflow-x-hidden overflow-y-hidden overscroll-contain">
            {bottomPanel}
          </div>
        </div>
      </div>

      <MissionCreditActionSheet
        open={creditSheetBucket !== null}
        onClose={() => setCreditSheetBucket(null)}
        bucket={creditSheetBucket ?? 'center'}
        floating={floatingCredits}
        wallet={walletCredits}
        piggy={piggyCredits}
        onPick={(kind) => setCreditMoveKind(kind)}
      />

      <MissionCreditMoveDialog
        open={creditMoveKind !== null}
        onClose={() => setCreditMoveKind(null)}
        childId={childId}
        kind={creditMoveKind}
        maxAmount={creditMoveKind ? maxAmountForKind(creditMoveKind) : 0}
        title={creditMoveKind ? transferCopy[creditMoveKind].title : ''}
        piggyBalance={piggyCredits}
        walletBalance={walletCredits}
        onSuccess={applyCreditTransferSuccess}
      />

      {/* 하트 5개 채움 축하 팝업 */}
      {heartsFullPopup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-5"
            role="dialog"
            aria-modal="true"
            aria-label="미션 완주 축하"
          >
            <div className="hearts-celebrate flex max-w-[min(22rem,calc(100vw-2.5rem))] flex-col items-center gap-4 rounded-3xl bg-white px-6 py-7 shadow-2xl ring-2 ring-pink-200">
              <div className="text-4xl">🎉</div>
              <p className="text-center text-base font-black leading-snug text-brand-text">
                축하해요!<br />배가 항해를 시작했어요!
              </p>
              <p className="text-center text-xs text-gray-400">
                오늘 미션을 90% 이상 완료했어요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setHeartsFullPopup(false)}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 active:scale-95"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    setHeartsFullPopup(false)
                    router.push('/home?openNavMap=1')
                  }}
                  className="rounded-xl bg-gradient-to-r from-pink-400 to-rose-500 px-4 py-2 text-sm font-bold text-white shadow active:scale-95"
                >
                  지도 보기
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
