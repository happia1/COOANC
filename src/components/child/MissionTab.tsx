'use client'

import Image from 'next/image'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, DailyMissionWithTemplate, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import GrowthMapSheet, { type GrowthMapSheetData } from '@/components/child/GrowthMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import { MapActionPill, StatPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { formatDateDot } from '@/lib/koreaDate'
import { parseSpecialMissionPopup } from '@/lib/specialMissionDescription'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import { parseAlarmFromMissionDescription } from '@/lib/missionAlarmDescription'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
  special: '특별',
}
const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  normal: 'bg-blue-100 text-blue-700',
  hard: 'bg-orange-100 text-orange-700',
  special: 'bg-purple-100 text-purple-700',
}
const BLOCK_LABEL: Record<string, string> = {
  morning: '아침',
  afternoon: '오후',
  evening: '저녁',
  bedtime: '잠자리',
}

function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${mStr ?? '00'}`
}

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
 * 미션 탭
 * - 상단: `ChildHomeSceneryBand`(60dvh) + 알약 줄 + 섬(지피뱅크) — 홈과 배경·비율 공통
 * - 잔디 구간: 오늘의 미션 제목과 EXP 막대
 * - 하단: min 40dvh + 가로 스냅 슬라이더
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
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [specialPopup, setSpecialPopup] = useState<{
    dailyMissionId: string
    headline: string
    missionTitle: string
    message: string
  } | null>(null)

  const ordered = useMemo(() => orderedMissionsForSlider(dailyMissions), [dailyMissions])

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

  async function handleComplete(dm: DailyMissionWithTemplate) {
    if (done.has(dm.id) || loading) return
    setLoading(dm.id)
    try {
      const res = await fetch('/api/daily-mission/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyMissionId: dm.id, today, childId }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요')
        return
      }
      setDone((prev) => new Set([...prev, dm.id]))
      const cr = typeof json.creditReward === 'number' ? json.creditReward : scaledMissionRewards(dm.missions).credit
      const er = typeof json.expReward === 'number' ? json.expReward : scaledMissionRewards(dm.missions).exp
      showToast(`+${cr} 크레딧 · +${er} EXP`)
    } catch {
      showToast('네트워크 오류가 발생했어요')
    } finally {
      setLoading(null)
    }
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

  /**
   * 잔디 위 헤더: 날짜 다음 줄에 **오늘의 미션** 과 **EXP 막대·수치·레벨** 을 같은 가로줄에 둡니다.
   * (미션을 하면 EXP 가 오르므로 완료 n/m 이중 막대는 제거했습니다.)
   */
  const grassMissionHeader = (
    <div className="relative z-[2] w-full px-3 pb-2 pt-1">
      <p className="text-[10px] font-bold text-emerald-900/70 [text-shadow:0_1px_0_rgba(255,255,255,0.85)]">
        {formatDateDot(today)}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-base font-black leading-tight text-emerald-950 [text-shadow:0_1px_1px_rgba(255,255,255,0.9)]">
            오늘의 미션
          </p>
          {promotionPending && (
            <span className="shrink-0 rounded-full bg-amber-300/95 px-2 py-0.5 text-[9px] font-black text-amber-950 shadow-sm">
              Level up
            </span>
          )}
        </div>
        <div
          className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:shrink-0"
          role="group"
          aria-label="경험치"
        >
          <div className="relative h-2.5 w-[min(38vw,132px)] max-w-full shrink-0 overflow-hidden rounded-full bg-white/50 shadow-inner ring-1 ring-pink-300/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-300 to-pink-500 transition-all duration-500"
              style={{ width: `${expPct}%` }}
            />
          </div>
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-black tabular-nums text-pink-700 [text-shadow:0_1px_0_rgba(255,255,255,0.9)]">
            <span aria-hidden>♥</span>
            <span>
              {exp}/{expToNext}
            </span>
          </span>
          <span className="shrink-0 text-[9px] font-bold tabular-nums text-emerald-900/80 [text-shadow:0_1px_0_rgba(255,255,255,0.85)]">
            Lv.{currentLevel}
          </span>
        </div>
      </div>
    </div>
  )

  /** 상단 60dvh — `ChildHomeSceneryBand` 로 홈과 배경·비율 공통화, 섬만 지피뱅크 PNG */
  const heroBand = (
    <ChildHomeSceneryBand ariaLabel="미션 배경">
      <div className="flex w-full shrink-0 items-center justify-between gap-1.5">
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

      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <div className="relative mx-auto flex w-full max-w-sm flex-col items-center">
          <div className="relative mx-auto h-[min(46dvh,400px)] min-h-[280px] w-full max-w-[20rem]">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-visible">
              <Image
                src="/assets/img/layouts/backgrounds/kids_background_island_gippybank.png"
                alt=""
                width={900}
                height={420}
                className="h-auto w-[118%] max-w-none select-none object-contain object-bottom [transform:translateY(4%)]"
                priority
              />
            </div>
          </div>
        </div>
        {!isFullRestDay ? grassMissionHeader : null}
      </div>
    </ChildHomeSceneryBand>
  )

  const bottomPanel = (
    <section
      className="flex min-h-[40dvh] flex-1 flex-col gap-2 bg-gradient-to-b from-lime-50/80 via-amber-50/30 to-white px-1 pb-2 pt-2"
      aria-label="오늘의 미션 카드"
    >
      {ordered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <p className="font-bold text-brand-text">아직 미션이 없어요</p>
          <p className="text-sm text-gray-400">부모님이 미션을 만들어주실 거예요!</p>
        </div>
      ) : (
        <div
          className="-mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-3 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {ordered.map((dm) => {
            const m = dm.missions
            if (!m) return null
            const isCompleted = done.has(dm.id)
            const isLoading = loading === dm.id
            const rewards = scaledMissionRewards(m)
            const special = isSpecialSectionMission(m)
            const timeLabel = formatTime(dm.scheduled_time)
            const sub = cardSubtitle(m.description)
            const block = m.block ? BLOCK_LABEL[m.block] : null
            return (
              <article
                key={dm.id}
                className={[
                  'snap-center shrink-0 flex w-[min(78vw,280px)] flex-col rounded-3xl border-2 p-4 shadow-lg transition-all',
                  special
                    ? isCompleted
                      ? 'border-amber-200/80 bg-amber-50/50 opacity-90'
                      : 'border-amber-300/90 bg-gradient-to-b from-amber-50 to-yellow-50 shadow-amber-200/40'
                    : isCompleted
                      ? 'border-pink-200/90 bg-rose-50/90'
                      : 'border-amber-100/90 bg-amber-50/80',
                ].join(' ')}
              >
                <div className="relative flex flex-col items-center pt-6">
                  <div
                    className={[
                      'absolute top-0 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white shadow-md',
                      isCompleted ? 'bg-pink-400' : 'bg-gray-300',
                    ].join(' ')}
                    aria-hidden
                  >
                    ✓
                  </div>
                  <div
                    className={[
                      'flex h-28 w-full items-center justify-center rounded-2xl text-5xl leading-none',
                      special ? 'bg-gradient-to-br from-amber-100/80 to-yellow-100' : 'bg-white/70',
                    ].join(' ')}
                  >
                    {m.icon_emoji?.trim() ? (
                      <span aria-hidden>{m.icon_emoji.trim()}</span>
                    ) : (
                      <span className="text-2xl font-black text-gray-400">{m.title.slice(0, 1)}</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 min-h-0 flex-1 text-center">
                  <p
                    className={`line-clamp-2 text-sm font-black ${isCompleted ? 'text-gray-400 line-through' : 'text-brand-text'}`}
                  >
                    {m.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${DIFFICULTY_COLOR[m.difficulty] ?? 'bg-gray-100 text-gray-500'}`}
                    >
                      {DIFFICULTY_LABEL[m.difficulty] ?? m.difficulty}
                    </span>
                    {block && (
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">
                        {block}
                      </span>
                    )}
                    {timeLabel && (
                      <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600">
                        {timeLabel}
                      </span>
                    )}
                  </div>
                  {sub && <p className="mt-1 line-clamp-2 text-[10px] text-gray-500">{sub}</p>}
                </div>

                <div className="mt-3 flex items-center justify-center gap-3 border-t border-white/60 pt-3 text-xs font-black text-gray-700">
                  <span className="flex items-center gap-1">
                    <span aria-hidden>🪙</span>
                    {rewards.credit}
                  </span>
                  {rewards.heart > 0 && (
                    <span className="flex items-center gap-1 text-pink-600">
                      <span aria-hidden>♥</span>
                      {rewards.heart}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-gray-400">+{rewards.exp} EXP</span>
                </div>

                {rewards.mult > 1 && (
                  <p className="mt-1 text-center text-[9px] font-bold text-amber-800">보상 {rewards.mult}배</p>
                )}

                <button
                  type="button"
                  onClick={() => handleComplete(dm)}
                  disabled={isCompleted || isLoading}
                  className={[
                    'mt-3 w-full rounded-2xl py-3 text-sm font-black transition-all active:scale-[0.98]',
                    isCompleted
                      ? 'bg-gray-200/80 text-gray-500'
                      : isLoading
                        ? 'cursor-wait bg-gray-100 text-gray-400'
                        : special
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md'
                          : 'bg-brand-blue text-white shadow-md',
                  ].join(' ')}
                >
                  {isCompleted ? '완료!' : isLoading ? '…' : '완료'}
                </button>
              </article>
            )
          })}
        </div>
      )}

      {total > 0 && completedCount === total && (
        <div className="mx-3 mb-2 rounded-2xl border-2 border-brand-yellow bg-brand-yellow/25 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-800">축하해요</p>
          <p className="font-black text-brand-text">오늘 미션 모두 완료!</p>
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
      <div className="relative z-[1] max-h-[min(85dvh,calc(100vh-2rem))] w-full max-w-sm overflow-y-auto rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-50 via-yellow-50 to-amber-100 p-5 shadow-xl shadow-amber-200/40">
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
        {heroBand}
        <section className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b from-lime-50/80 to-white px-6 py-10 text-center">
          <span className="text-sm font-black text-gray-400">휴식</span>
          <p className="text-xl font-black text-brand-text">오늘은 쉬는 날이에요!</p>
          <p className="text-sm text-gray-400">푹 쉬고 내일 또 열심히 해봐요.</p>
        </section>
        {popupBlock}
        {sheets}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
