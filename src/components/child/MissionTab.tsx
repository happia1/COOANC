'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, DailyMissionWithTemplate, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import GrowthMapSheet, { type GrowthMapSheetData } from '@/components/child/GrowthMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import { MapActionPill, StatPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import ChildHomeIslandStage from '@/components/child/ChildHomeIslandStage'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { parseSpecialMissionPopup } from '@/lib/specialMissionDescription'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import { parseAlarmFromMissionDescription } from '@/lib/missionAlarmDescription'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import MissionSleepMorningLayer from '@/components/child/MissionSleepMorningLayer'
import SpriteImage from '@/components/common/SpriteImage'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'

type Props = {
  childId: string
  childName: string
  initialStats: ChildStats | null
  growthMapData: GrowthMapSheetData
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
 * 부모 「다시하기」 브로드캐스트 페이로드 형식 검사 — 잘못된 메시지는 무시합니다.
 */
function isRedoMissionPayload(v: unknown): v is { missionLogId: string; dailyMissionId: string; title: string } {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.missionLogId === 'string' &&
    typeof o.dailyMissionId === 'string' &&
    typeof o.title === 'string'
  )
}

/**
 * 미션 탭
 * - **6:4**: 상단 풍경 `flex-[6]` + 하단 카드 `flex-[4]` — 세로 스크롤 없음, 카드는 가로 스크롤
 * - 카드 썸네일: `public/.../routines_01.png` 아틀라스(`missionRoutineIconFrame`)
 * - 부모 Realtime 「다시 하기」·`MissionSleepMorningLayer` 연출 동일
 */
export default function MissionTab({
  childId,
  childName,
  initialStats,
  growthMapData,
  initialPraiseGrants,
  initialPraisePlacements,
  dailyMissions,
  today,
  isFullRestDay,
}: Props) {
  const [stats, setStats] = useState<ChildStats | null>(initialStats)
  const [mapOpen, setMapOpen] = useState(false)
  const [bearOpen, setBearOpen] = useState(false)
  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
  const [stickerFabImgOk, setStickerFabImgOk] = useState(true)

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

  /** 부모가 「다시하기」를 눌렀을 때만 채워지는 미션 되돌리기 안내 */
  const [redoPopup, setRedoPopup] = useState<{
    missionLogId: string
    dailyMissionId: string
    title: string
  } | null>(null)
  const [redoBusy, setRedoBusy] = useState(false)

  /** 이미 SUBSCRIBED 인 채널에 바로 send — 매번 subscribe 하지 않아 부모 목록 갱신이 빨라집니다 */
  const parentLogBroadcastRef = useRef<RealtimeChannel | null>(null)

  const ordered = useMemo(() => orderedMissionsForSlider(dailyMissions), [dailyMissions])

  /** 완료한 카드는 가로 슬라이더에서 제거해 바로 「사라진」 느낌을 줍니다 */
  const incompleteOrdered = useMemo(() => ordered.filter((dm) => !done.has(dm.id)), [ordered, done])

  const growthPayload: GrowthMapSheetData = useMemo(
    () => ({
      ...growthMapData,
      level: stats?.current_level ?? growthMapData.level,
      streak: stats?.streak_days ?? growthMapData.streak,
      longestStreak: stats?.longest_streak ?? growthMapData.longestStreak,
    }),
    [growthMapData, stats],
  )

  useEffect(() => {
    setStats(initialStats)
  }, [initialStats])

  useEffect(() => {
    setGrants((prev) => mergePraiseStickerGrantsFromServer(initialPraiseGrants, prev))
  }, [initialPraiseGrants])

  useEffect(() => {
    setPlacements(initialPraisePlacements)
  }, [initialPraisePlacements])

  /** 홈과 동일: 판에 붙인 뒤 grants 는 건드리지 않아 도착 팝업 상태가 꼬이지 않게 함 */
  const refreshStickerPlacementsOnly = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('praise_sticker_placements').select('*').eq('child_id', childId)
    if (data) setPlacements(data as PraiseStickerPlacement[])
  }, [childId])

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
          setStats(payload.new as ChildStats)
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

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`mission_redo:${childId}`)
      .on('broadcast', { event: 'redo_mission' }, (message) => {
        const raw = (message as { payload?: unknown }).payload
        if (isRedoMissionPayload(raw)) setRedoPopup(raw)
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

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

  /**
   * 팝업 「확인」: 오늘의 미션 행·로그·스탯을 부모용 롤백 API와 같은 방식으로 되돌립니다.
   * (자녀 세션의 RLS 로 본인 행만 수정 가능)
   */
  async function confirmRedoFromParent() {
    if (!redoPopup || redoBusy) return
    setRedoBusy(true)
    const supabase = createClient()
    try {
      const { data: log, error: logErr } = await supabase
        .from('mission_logs')
        .select('id, is_completed, credit_earned, heart_earned, exp_earned')
        .eq('id', redoPopup.missionLogId)
        .eq('child_id', childId)
        .maybeSingle()

      if (logErr || !log?.is_completed) {
        showToast('이미 되돌아간 미션이에요')
        setRedoPopup(null)
        return
      }

      const cr = typeof log.credit_earned === 'number' ? log.credit_earned : 0
      const hr = typeof log.heart_earned === 'number' ? log.heart_earned : 0
      const xr = typeof log.exp_earned === 'number' ? log.exp_earned : 0

      const { data: stats, error: stErr } = await supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle()
      if (stErr || !stats) {
        showToast('정보를 불러오지 못했어요')
        return
      }

      const newExp = Math.max(0, stats.exp - xr)
      const newLevel = stats.current_level

      const { error: dmErr } = await supabase
        .from('daily_missions')
        .update({ is_completed: false, completed_at: null })
        .eq('id', redoPopup.dailyMissionId)
        .eq('child_id', childId)

      const { error: mlErr } = await supabase
        .from('mission_logs')
        .update({
          is_completed: false,
          completed_at: null,
          credit_earned: 0,
          heart_earned: 0,
          exp_earned: 0,
        })
        .eq('id', redoPopup.missionLogId)
        .eq('child_id', childId)

      const { error: csErr } = await supabase
        .from('child_stats')
        .update({
          credits: Math.max(0, stats.credits - cr),
          hearts: Math.max(0, stats.hearts - hr),
          total_credits_earned: Math.max(0, stats.total_credits_earned - cr),
          exp: newExp,
          current_level: newLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('child_id', childId)

      if (dmErr || mlErr || csErr) {
        showToast('되돌리기에 실패했어요')
        return
      }

      setDone((prev) => {
        const next = new Set(prev)
        next.delete(redoPopup.dailyMissionId)
        return next
      })
      setRedoPopup(null)
      showToast('미션을 다시 할 수 있어요')
    } finally {
      setRedoBusy(false)
    }
  }

  function handleComplete(dm: DailyMissionWithTemplate) {
    if (done.has(dm.id)) return

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

  const credits = stats?.credits ?? 0
  const streak = stats?.streak_days ?? 0
  const exp = stats?.exp ?? 0
  const expToNext = Math.max(1, stats?.exp_to_next_level ?? 1)
  const promotionPending = Boolean(stats?.promotion_pending)
  const currentLevel = stats?.current_level ?? 0
  const expPct = Math.min(100, (exp / expToNext) * 100)

  const completedCount = done.size
  const total = dailyMissions.length

  /**
   * 섬 위 저금통 그림: 휴식일이면 항상 「비어 있음」 단계만 보여 주고,
   * 평일에는 「완료한 미션 수 ÷ 오늘 미션 전체」에 맞춰 아틀라스 프레임이 바뀝니다.
   */
  const islandPiggyProgress = isFullRestDay ? { completed: 0, total: 0 } : { completed: completedCount, total }

  const sheets = (
    <>
      <GrowthMapSheet
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        childName={childName}
        stats={stats}
        data={growthPayload}
      />
      <BearStickerSheet
        open={bearOpen}
        onClose={() => setBearOpen(false)}
        childId={childId}
        initialGrants={grants}
        initialPlacements={placements}
        onInventoryChange={() => void refreshStickerPlacementsOnly()}
      />
    </>
  )

  /** 카드 바로 위 한 줄: 왼쪽 「오늘의 미션」·오른쪽 EXP(날짜 없음) */
  const missionTitleAboveCards = (
    <div className="shrink-0 px-3 pb-0.5 pt-0">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-base font-black leading-tight text-brand-text">오늘의 미션</h2>
          {promotionPending && (
            <span className="shrink-0 rounded-full bg-amber-300/95 px-2 py-0.5 text-[9px] font-black text-amber-950 shadow-sm">
              Level up
            </span>
          )}
        </div>
        <div
          className="flex min-w-0 flex-wrap items-center justify-end gap-2"
          role="group"
          aria-label="경험치"
        >
          <div className="relative h-2.5 w-[min(38vw,132px)] max-w-full shrink-0 overflow-hidden rounded-full bg-white/50 shadow-inner ring-1 ring-pink-300/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-300 to-pink-500 transition-all duration-500"
              style={{ width: `${expPct}%` }}
            />
          </div>
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-black tabular-nums text-pink-700">
            <span aria-hidden>♥</span>
            <span>
              {exp}/{expToNext}
            </span>
          </span>
          <span className="shrink-0 text-[9px] font-bold tabular-nums text-emerald-800">
            Lv.{currentLevel}
          </span>
        </div>
      </div>
    </div>
  )

  /** 상단 풍경: `flexFill` 로 레이아웃이 주는 높이만 씀(고정 dvh 아님) */
  const heroBand = (
    <ChildHomeSceneryBand flexFill ariaLabel="미션 배경">
      <div className="relative z-20 flex w-full shrink-0 items-center justify-between gap-1.5">
        <StatPill label="연속" value={`${streak}일`} className="shrink-0" />
        <div className="flex shrink-0 items-center gap-1.5">
          <MapActionPill onClick={() => setMapOpen(true)} />
          <StickerActionPill
            useCustomImage={stickerFabImgOk}
            onImageError={() => setStickerFabImgOk(false)}
            onClick={() => setBearOpen(true)}
          />
        </div>
        <StatPill label="크레딧" value={credits.toLocaleString()} highlight className="shrink-0" />
      </div>

      {/** `flex-1 min-h-0`: 홈과 같이 섬 무대가 풍경 밴드 안 남는 공간에 맞춰 줄어듦 */}
      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end -mt-6 sm:-mt-8">
          <ChildHomeIslandStage scene="gippybank" missionPiggy={islandPiggyProgress} density="flex" />
        </div>
      </div>
    </ChildHomeSceneryBand>
  )

  const bottomPanel = (
    <section
      className="relative z-10 -mt-8 flex min-h-0 flex-[4] basis-0 flex-col gap-1 overflow-hidden px-1 pb-1.5 pt-1 sm:-mt-10"
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
          className="-mx-1 flex min-h-0 flex-1 items-stretch gap-1.5 overflow-x-auto overflow-y-hidden px-2 pb-0.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
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
              <article
                key={dm.id}
                className={[
                  'snap-center flex h-full min-h-0 w-[min(42vw,158px)] shrink-0 flex-col rounded-xl border-2 px-1.5 pb-1 pt-1.5 shadow-sm transition-all',
                  special
                    ? 'border-amber-300/90 bg-gradient-to-b from-amber-50 to-yellow-50 shadow-amber-200/40'
                    : 'border-amber-100/90 bg-amber-50/80',
                ].join(' ')}
              >
                {/**
                 * `routines_01.png` 아틀라스 프레임 — 회전 프레임은 `clipRotated={false}` 로 잘림 완화.
                 * 이미지 파일이 없으면 Next/Image 처럼 깨져 보일 수 있으니 `public/.../routines_01.png` 를 두어야 함.
                 */}
                <div
                  className={[
                    'flex min-h-[5.75rem] w-full flex-shrink-0 items-center justify-center overflow-visible rounded-xl',
                    special ? 'bg-gradient-to-br from-amber-100/80 to-yellow-100' : 'bg-white/85',
                  ].join(' ')}
                >
                  <SpriteImage
                    sheet={MISSION_ROUTINES_ATLAS}
                    frame={routineFrame}
                    width={72}
                    clipRotated={false}
                    className="select-none drop-shadow-sm"
                  />
                </div>

                <div className="mt-1 min-h-0 flex-1 text-center">
                  <p className="line-clamp-2 text-[11px] font-black leading-[1.2] text-brand-text">{m.title}</p>
                  {sub && <p className="mt-1 line-clamp-2 text-[8px] leading-tight text-gray-500">{sub}</p>}
                </div>

                <div className="mt-auto flex items-center justify-center gap-1 border-t border-white/50 pt-1 text-[9px] font-black leading-none text-gray-700">
                  <span className="flex items-center gap-0.5">
                    <span aria-hidden className="text-[9px]">
                      🪙
                    </span>
                    {rewards.credit}
                  </span>
                  {rewards.heart > 0 && (
                    <span className="flex items-center gap-0.5 text-pink-600">
                      <span aria-hidden>♥</span>
                      {rewards.heart}
                    </span>
                  )}
                  <span className="text-[8px] font-bold text-gray-400">+{rewards.exp} EXP</span>
                </div>

                {rewards.mult > 1 && (
                  <p className="mt-px text-center text-[7px] font-bold leading-tight text-amber-800">보상 {rewards.mult}배</p>
                )}

                <button
                  type="button"
                  onClick={() => handleComplete(dm)}
                  className={[
                    'mt-1 w-full rounded-lg py-1 text-[10px] font-black leading-none transition-all active:scale-[0.98]',
                    special
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm'
                      : 'bg-brand-blue text-white shadow-sm',
                  ].join(' ')}
                >
                  완료
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )

  /** 부모가 요청한 「다시 하기」 — 확인 시에만 DB 가 바뀝니다 */
  const redoPopupBlock = redoPopup ? (
    <div
      className="fixed inset-0 z-[102] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redo-pop-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="나중에 하기"
        onClick={() => !redoBusy && setRedoPopup(null)}
      />
      <div className="relative z-[1] w-full max-w-sm rounded-2xl border-2 border-orange-200 bg-white p-5 shadow-xl">
        <p id="redo-pop-title" className="text-center text-base font-black text-brand-text leading-snug">
          <span className="text-orange-600">{redoPopup.title}</span> 미션을 다시 해야 해요!
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">부모님이 다시 하라고 하셨어요. 확인을 누르면 완료가 취소돼요.</p>
        <button
          type="button"
          onClick={() => void confirmRedoFromParent()}
          disabled={redoBusy}
          className="mt-5 w-full rounded-xl bg-brand-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {redoBusy ? '처리 중…' : '확인'}
        </button>
      </div>
    </div>
  ) : null

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

  if (isFullRestDay) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <MissionSleepMorningLayer
          childId={childId}
          today={today}
          isFullRestDay={isFullRestDay}
          completedCount={completedCount}
          totalMissions={total}
        />
        {heroBand}
        <section className="flex min-h-0 flex-[4] flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-b from-lime-50/80 to-white px-6 py-4 text-center">
          <span className="text-sm font-black text-gray-400">휴식</span>
          <p className="text-xl font-black text-brand-text">오늘은 쉬는 날이에요!</p>
          <p className="text-sm text-gray-400">푹 쉬고 내일 또 열심히 해봐요.</p>
        </section>
        {redoPopupBlock}
        {popupBlock}
        {sheets}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MissionSleepMorningLayer
        childId={childId}
        today={today}
        isFullRestDay={isFullRestDay}
        completedCount={completedCount}
        totalMissions={total}
      />
      {redoPopupBlock}
      {popupBlock}
      {toast && (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 animate-bounce rounded-full bg-brand-blue px-5 py-2.5 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
      {heroBand}
      {bottomPanel}
      {sheets}
    </div>
  )
}
