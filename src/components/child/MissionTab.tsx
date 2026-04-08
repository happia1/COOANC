'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, DailyMissionWithTemplate } from '@/types/database'
import ChildHomeIslandStage from '@/components/child/ChildHomeIslandStage'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { parseSpecialMissionPopup } from '@/lib/specialMissionDescription'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import { parseAlarmFromMissionDescription } from '@/lib/missionAlarmDescription'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import MissionSleepMorningLayer from '@/components/child/MissionSleepMorningLayer'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
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

type Props = {
  childId: string
  initialStats: ChildStats | null
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

function orderedMissionsForSlider(list: DailyMissionWithTemplate[]): DailyMissionWithTemplate[] {
  const routineRows = list.filter((dm) => dm.missions && !isSpecialSectionMission(dm.missions))
  const specialRows = list.filter((dm) => dm.missions && isSpecialSectionMission(dm.missions))
  const blockOrder: (string | null)[] = ['morning', 'afternoon', 'evening', 'bedtime', null]
  const out: DailyMissionWithTemplate[] = []
  for (const bk of blockOrder) {
    out.push(...routineRows.filter((dm) => (dm.missions.block ?? null) === bk))
  }
  out.push(...specialRows)
  return out
}

/**
 * 부모 「다시하기」 후 서버 롤백이 끝난 뒤 오는 브로드캐스트 페이로드 검사 — 형식이 맞지 않으면 무시합니다.
 */
function isMissionRolledBackPayload(v: unknown): v is { dailyMissionId: string; title: string } {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.dailyMissionId === 'string' && typeof o.title === 'string'
}

/**
 * 미션 탭
 * - 배경: 미션 상단 잔디 PNG 는 쓰지 않고, 자녀 레이아웃 배경만 보입니다.
 * - **6:4**: 상단 풍경 `flex-[6]` + 하단 카드 `flex-[4]` — 세로 스크롤 없음, 카드는 가로 스크롤
 * - 카드 썸네일: `public/.../routines_01.png` 아틀라스(`missionRoutineIconFrame`)
 * - 부모 Realtime 「다시 하기」: DB 는 서버에서 이미 되돌아가고, 여기서는 카드만 슬라이더에 다시 보이게 맞춥니다.
 * - 칭찬 스티커(곰돌이) 단추는 **홈** 화면 플로팅 버튼으로만 엽니다.
 */
export default function MissionTab({
  childId,
  initialStats,
  dailyMissions,
  today,
  isFullRestDay,
}: Props) {
  const [stats, setStats] = useState<ChildStats | null>(initialStats)
  /** 지갑·저금통·섬 옮기기: 먼저 어떤 통을 눌렀는지(시트) → 종류 선택 후 수량 팝업 */
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
    message: string
  } | null>(null)

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

  const ordered = useMemo(() => orderedMissionsForSlider(dailyMissions), [dailyMissions])

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
    for (const dm of dailyMissions) {
      const m = dm.missions
      if (!m || !isSpecialSectionMission(m)) continue
      if (m.repeat_type !== 'event') continue
      const { isSpecial, popupMessage } = parseSpecialMissionPopup(m.description)
      if (!isSpecial) continue
      const key = `cooanc_sp_shown_${dm.id}_${today}`
      if (sessionStorage.getItem(key)) continue
      setSpecialPopup({
        dailyMissionId: dm.id,
        headline: '특별 미션이 도착했어요!',
        missionTitle: m.title,
        message: popupMessage.trim() || '오늘만 하는 특별 미션을 완료해 보아요!',
      })
      break
    }
  }, [dailyMissions, today])

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
  const exp = stats?.exp ?? 0
  const expToNext = Math.max(1, stats?.exp_to_next_level ?? 1)
  const promotionPending = Boolean(stats?.promotion_pending)
  const expPct = Math.min(100, (exp / expToNext) * 100)

  const completedCount = done.size
  const total = dailyMissions.length

  /** 크레딧 옮기기 팝업 제목만(본문 힌트는 레이아웃·겹침 이슈로 팝업에서 제거함) */
  const transferCopy: Record<CreditTransferKind, { title: string }> = {
    float_to_wallet: { title: '지갑으로 옮기기' },
    float_to_piggy: { title: '저금통으로 옮기기' },
    wallet_to_float: { title: '섬으로 꺼내기' },
    piggy_to_float: { title: '섬으로 꺼내기' },
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
   * 카드 바로 위 **한 행**: 왼쪽 제목 · 오른쪽 EXP.
   * - EXP 영역: 왼쪽 **스페이서 `flex-1`** + 오른쪽 **막대·♥·숫자 `shrink-0`** → 묶음이 행 오른쪽에 붙음
   * - 막대 너비는 `clamp`(뷰포트에 따라 길이 변함, 상한 `18rem`)
   */
  const missionTitleAboveCards = (
    <div className="shrink-0 px-3 pb-0.5 pt-0">
      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        <div className="flex min-w-0 flex-[0_1_auto] items-center gap-2 overflow-hidden">
          <h2 className="min-w-0 truncate text-base font-black leading-tight text-brand-text">오늘의 미션</h2>
          {promotionPending && (
            <span className="shrink-0 rounded-full bg-amber-300/95 px-2 py-0.5 text-[9px] font-black text-amber-950 shadow-sm">
              Level up
            </span>
          )}
        </div>
        <div
          className="flex min-w-0 min-h-[18px] flex-1 flex-nowrap items-center gap-1"
          role="group"
          aria-label={`경험치 ${exp}, 목표 ${expToNext}`}
        >
          {/* 남는 가로를 여기서만 먹어서 막대·♥·숫자 묶음이 행의 오른쪽(패딩 안쪽)에 붙음 */}
          <div className="min-h-0 min-w-0 flex-1 shrink" aria-hidden />
          <div className="flex shrink-0 items-center gap-1">
            {/**
             * `clamp`: 좁은 화면은 최소 폭만, 넓어질수록 길어지다 `18rem` 에서 멈춤.
             * 묶음은 `shrink-0` 이라 ♥·목표 숫자가 오른쪽 끝에 고정된 채 막대만 길이가 변함.
             */}
            <div className="relative h-[18px] min-w-[3.25rem] w-[clamp(3.25rem,32vw,18rem)] overflow-hidden rounded-full bg-white/50 shadow-inner ring-1 ring-pink-300/50 sm:w-[clamp(3.25rem,36vw,18rem)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pink-300 to-pink-500 transition-all duration-500"
                style={{ width: `${expPct}%` }}
              />
              <span className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-[10px] font-black tabular-nums leading-none text-pink-950 drop-shadow-[0_0_2px_rgba(255,255,255,0.95)]">
                {exp}
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-black tabular-nums text-pink-700 sm:text-[11px]">
              <span aria-hidden>♥</span>
              <span>{expToNext}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  /**
   * 상단 영역: `flexFill` 로 레이아웃이 주는 높이만 씀(고정 dvh 아님).
   * 배경 이미지는 사용하지 않고(`showBackground={false}`), 기존 투명 상단 밴드만 유지합니다.
   * 저금통/크레딧/지갑 위치는 기존 레이아웃 그대로 유지됩니다.
   */
  const heroBand = (
    <ChildHomeSceneryBand
      flexFill
      /** 상단 배경 이미지를 완전히 비활성화합니다. */
      showBackground={false}
      /** 밴드 자체 바탕색은 투명으로 두어 이미지 외 배경 덮임을 막습니다. */
      className="bg-transparent"
      ariaLabel="미션 상단"
    >
      {/** 연속일 등 상단 StatPill 은 사용하지 않음 — 크레딧은 섬 가운데·지갑·저금통에서 확인 */}
      {/** `flex-1 min-h-0`: 홈과 같이 섬 무대가 풍경 밴드 안 남는 공간에 맞춰 줄어듦 */}
      {/** `overflow-visible`: 섬·저금통 스프라이트가 세로로 삐져나와도 잘리지 않게 */}
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-visible">
        <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end overflow-visible -mt-10 sm:-mt-12">
          <ChildHomeIslandStage
            scene="gippybank"
            density="flex"
            showIslandArt={false}
            missionPiggy={{ completed: completedCount, total }}
            missionCredits={{
              floating: floatingCredits,
              wallet: walletCredits,
              piggy: piggyCredits,
              onCenterTap: () => {
                if (floatingCredits > 0) setCreditSheetBucket('center')
              },
              onWalletTap: () => setCreditSheetBucket('wallet'),
              onPiggyTap: () => setCreditSheetBucket('piggy'),
            }}
          />
        </div>
      </div>
    </ChildHomeSceneryBand>
  )

  const bottomPanel = (
    <section
      className="relative z-10 -mt-9 flex min-h-0 flex-[4.4] basis-0 flex-col gap-1 overflow-hidden px-1 pb-0 pt-0.5 sm:-mt-10"
      aria-label="오늘의 미션 카드"
    >
      {missionTitleAboveCards}
      {ordered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <p className="font-bold text-brand-text">아직 미션이 없어요</p>
          <p className="text-sm text-gray-400">부모님이 미션을 만들어주실 거예요!</p>
        </div>
      ) : incompleteOrdered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-6 text-center">
          <p className="text-sm font-bold text-gray-500">남은 미션 카드가 없어요</p>
          <p className="text-xs text-gray-400">아래에서 오늘의 결과를 확인해 보아요</p>
        </div>
      ) : (
        <div
          className="-mx-1 flex min-h-0 flex-1 items-start gap-1.5 overflow-x-auto overflow-y-hidden px-1.5 pb-0 pt-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {incompleteOrdered.map((dm) => {
            const m = dm.missions
            if (!m) return null
            const rewards = scaledMissionRewards(m)
            const special = isSpecialSectionMission(m)
            const sub = cardSubtitle(m.description)
            const routineFrame = missionRoutineIconFrame(m.title, m.description)
            return (
              <button
                key={dm.id}
                type="button"
                onClick={(ev) => handleComplete(dm, ev)}
                aria-label={`${m.title} 미션 완료하기`}
                className={[
                  // 카드 하단 빈 여백을 줄이기 위해 최소 높이를 더 낮춰 내용 높이에 가깝게 맞춤
                  // 가로: 화면 너비의 32%와 최대 140px 중 작은 값 — 한눈에 카드가 더 많이 보이도록 이전(42vw/168px)보다 좁게 유지
                  'snap-center flex min-h-[9rem] w-[min(32vw,140px)] shrink-0 flex-col rounded-xl border bg-white p-2 text-left font-sans text-brand-text shadow-md transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 active:scale-[0.97]',
                  special ? 'border-amber-300 ring-2 ring-amber-200/60' : 'border-gray-200/90',
                ].join(' ')}
              >
                {/**
                 * 카드 전체 탭 = 완료. 일반 미션은 흰 카드, 특별만 앰버 테두리.
                 * `routines_01.png` 아틀라스 — `clipRotated={false}` 로 회전 프레임 잘림 완화.
                 */}
                {/** 배경색 없음 — 아틀라스 일러스트만 흰 카드 위에 표시 */}
                <div className="flex min-h-[5.6rem] w-full shrink-0 items-center justify-center overflow-visible">
                  <SpriteImage
                    sheet={MISSION_ROUTINES_ATLAS}
                    frame={routineFrame}
                    // 요청대로 이미지 크기를 소폭 축소
                    width={52}
                    clipRotated={false}
                    className="select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  />
                </div>

                <div className="mt-0 space-y-0 text-center">
                  <p className="line-clamp-2 text-[10px] font-black leading-tight text-brand-text">{m.title}</p>
                  {sub ? (
                    <p className="line-clamp-2 text-[9px] font-medium leading-snug text-gray-500">{sub}</p>
                  ) : null}
                </div>

                {/**
                 * 보상 줄: 실제 파일은 `public/assets/img/common/ui/icons.png` 이고,
                 * 여기서는 `ICONS` 상수로 같은 PNG를 가리킵니다(`/assets/img/common/ui/icons.png`).
                 * 시안과 동일하게 한 줄: [크레딧 아이콘+숫자] [하트 아이콘+숫자] — 오른쪽은 EXP(텍스트 없이 하트로 표현).
                 */}
                <div className="mt-0 flex justify-center">
                  <div
                    className={[
                      // 보상 숫자/아이콘이 알약 내부에서 안 잘리도록 간격과 패딩을 타이트하게 조정
                      'inline-flex max-w-full flex-nowrap items-center justify-center gap-x-1 rounded-full px-2 py-1 text-[11px] font-black tabular-nums tracking-[-0.01em] text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06]',
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
                        width={16}
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
                        width={16}
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
      )}
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
        <p className="mt-2 text-center text-sm font-bold text-amber-800">{specialPopup.missionTitle}</p>
        <p className="mt-3 text-center text-sm leading-relaxed text-amber-900/80">{specialPopup.message}</p>
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

  if (isFullRestDay) {
    /** 휴식일은 전체 배경을 건드리지 않고, 위 `heroBand`(상단)에서만 이미지가 보입니다. */
    return (
      <div className="relative -mx-4 -mb-[calc(60px+0.35rem)] -mt-4 flex min-h-0 flex-1 flex-col bg-transparent">
        <MissionSleepMorningLayer
          childId={childId}
          today={today}
          isFullRestDay={isFullRestDay}
          completedCount={completedCount}
          totalMissions={total}
        />
        {heroBand}
        <section className="flex min-h-0 flex-[4] flex-col items-center justify-center gap-3 overflow-hidden bg-transparent px-6 py-4 text-center">
          <span className="text-sm font-black text-gray-400">휴식</span>
          <p className="text-xl font-black text-brand-text">오늘은 쉬는 날이에요!</p>
          <p className="text-sm text-gray-400">푹 쉬고 내일 또 열심히 해봐요.</p>
        </section>
        {popupBlock}
        {rollbackPopupBlock}

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
          onSuccess={applyCreditTransferSuccess}
        />
      </div>
    )
  }

  /** 일반일도 전체 배경은 투명 유지, 상단 영역(`heroBand`)에서만 새 이미지를 표시합니다. */
  return (
    <div className="relative -mx-4 -mb-[calc(60px+0.35rem)] -mt-4 flex min-h-0 flex-1 flex-col bg-transparent">
      <MissionSleepMorningLayer
        childId={childId}
        today={today}
        isFullRestDay={isFullRestDay}
        completedCount={completedCount}
        totalMissions={total}
      />
      {popupBlock}
      {rollbackPopupBlock}
      {toast && (
        <div className="fixed top-6 left-1/2 z-[110] -translate-x-1/2 animate-bounce rounded-full bg-brand-blue px-5 py-2.5 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
      {creditFxOn ? (
        <MissionCreditToPiggyOverlay
          playId={creditFxNonce}
          onFinish={endCreditFx}
          startX={creditFxStart.x}
          startY={creditFxStart.y}
        />
      ) : null}
      {heroBand}
      {bottomPanel}

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
        onSuccess={applyCreditTransferSuccess}
      />
    </div>
  )
}
