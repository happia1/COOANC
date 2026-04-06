'use client'

import { useState, useEffect } from 'react'
import type { DailyMissionWithTemplate } from '@/types/database'
import { formatDateDot } from '@/lib/koreaDate'
import { parseSpecialMissionPopup } from '@/lib/specialMissionDescription'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import { parseAlarmFromMissionDescription } from '@/lib/missionAlarmDescription'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '쉬움', normal: '보통', hard: '어려움', special: '특별',
}
const DIFFICULTY_COLOR: Record<string, string> = {
  easy:    'bg-green-100 text-green-700',
  normal:  'bg-blue-100 text-blue-700',
  hard:    'bg-orange-100 text-orange-700',
  special: 'bg-purple-100 text-purple-700',
}
const BLOCK_LABEL: Record<string, string> = {
  morning: '아침',
  afternoon: '오후',
  evening: '저녁',
  bedtime: '잠자리',
}

/** "HH:MM" → "오전/오후 H:MM" */
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
  dailyMissions: DailyMissionWithTemplate[]
  credits: number
  streak: number
  today: string
  /** 공휴일 등으로 쉬는 날이면서 오늘 배정된 미션이 없을 때만 true (스페셜만 있는 날은 false) */
  isFullRestDay: boolean
}

/** 카드 아래에 보여 줄 부가 설명 — 알람 JSON·스페셜 메타 JSON은 숨김 */
function cardSubtitle(description: string | null | undefined): string | null {
  if (!description?.trim()) return null
  if (parseSpecialMissionPopup(description).isSpecial) return null
  if (parseAlarmFromMissionDescription(description).alarmFile) return null
  return description
}

export default function MissionTab({
  childId,
  dailyMissions,
  credits,
  streak,
  today,
  isFullRestDay,
}: Props) {
  const [done, setDone] = useState<Set<string>>(
    new Set(dailyMissions.filter(dm => dm.is_completed).map(dm => dm.id))
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  /** 이벤트형 스페셜이 오늘 일정에 들어왔을 때 — 하루·행당 한 번 */
  const [specialPopup, setSpecialPopup] = useState<{
    dailyMissionId: string
    headline: string
    missionTitle: string
    message: string
  } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    for (const dm of dailyMissions) {
      const m = dm.missions
      if (!isSpecialSectionMission(m)) continue
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
      if (!res.ok) { showToast(json.error ?? '오류가 발생했어요'); return }
      setDone(prev => new Set([...prev, dm.id]))
      const cr = typeof json.creditReward === 'number' ? json.creditReward : scaledMissionRewards(dm.missions).credit
      const er = typeof json.expReward === 'number' ? json.expReward : scaledMissionRewards(dm.missions).exp
      showToast(`+${cr} 크레딧 · +${er} EXP`)
    } catch {
      showToast('네트워크 오류가 발생했어요')
    } finally {
      setLoading(null)
    }
  }

  const completedCount = done.size
  const total          = dailyMissions.length

  /** 일상 블록(시간대 그룹) — 스페셜 키워드 데일리는 스페셜 구역으로만 */
  const routineRows = dailyMissions.filter((dm) => !isSpecialSectionMission(dm.missions))
  const specialRows = dailyMissions.filter((dm) => isSpecialSectionMission(dm.missions))

  // ── 블록 그룹핑 (일상 미션만 묶음)
  const blockOrder: (string | null)[] = ['morning', 'afternoon', 'evening', 'bedtime', null]
  const grouped = blockOrder.map(bk => ({
    block: bk,
    items: routineRows.filter(dm => (dm.missions.block ?? null) === bk),
  })).filter(g => g.items.length > 0)

  // ── 공휴일 등 완전 휴식 + 오늘 카드 없음
  if (isFullRestDay) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5">
        <span className="text-sm font-black text-gray-400">휴식</span>
        <div className="text-center space-y-1">
          <p className="font-black text-brand-text text-xl">오늘은 쉬는 날이에요!</p>
          <p className="text-sm text-gray-400">푹 쉬고 내일 또 열심히 해봐요.</p>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 shadow-sm">
            <span className="text-[10px] font-bold text-gray-500">연속</span>
            <span className="text-sm font-bold tabular-nums text-brand-text">{streak}일</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-brand-yellow/30 px-3.5 py-1.5 ring-1 ring-brand-yellow shadow-sm">
            <span className="text-[10px] font-bold text-amber-800/80">크레딧</span>
            <span className="text-sm font-bold tabular-nums text-brand-text">{credits.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {specialPopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="sp-pop-title">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="닫기" onClick={dismissSpecialPopup} />
          <div className="relative m-4 w-full max-w-sm rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-50 via-yellow-50 to-amber-100 p-5 shadow-xl shadow-amber-200/40">
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
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-blue text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* 상단 스탯 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 shadow-sm">
          <span className="text-[10px] font-bold text-gray-500">연속</span>
          <span className="text-sm font-bold tabular-nums text-brand-text">{streak}일</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-brand-yellow/30 px-3.5 py-1.5 ring-1 ring-brand-yellow shadow-sm">
          <span className="text-[10px] font-bold text-amber-800/80">크레딧</span>
          <span className="text-sm font-bold tabular-nums text-brand-text">{credits.toLocaleString()}</span>
        </div>
      </div>

      {/* 오늘의 미션 헤더 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{formatDateDot(today)}</p>
            <p className="font-black text-brand-text text-lg">오늘의 미션</p>
          </div>
          {total > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-brand-blue">{completedCount}/{total}</span>
              <span className="text-[10px] text-gray-400">완료</span>
            </div>
          )}
        </div>
        {total > 0 && (
          <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-700"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* 미션 목록 */}
      {dailyMissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="text-center space-y-1">
            <p className="font-bold text-brand-text">아직 미션이 없어요</p>
            <p className="text-sm text-gray-400">부모님이 미션을 만들어주실 거예요!</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(({ block, items }) => (
            <div key={block ?? 'none'}>
              {block && (
                <p className="text-xs font-black text-gray-500 mb-2 px-1">{BLOCK_LABEL[block]}</p>
              )}
              <div className="flex flex-col gap-3">
                {items.map((dm) => {
                  const isCompleted = done.has(dm.id)
                  const isLoading   = loading === dm.id
                  const timeLabel   = formatTime(dm.scheduled_time)
                  const m           = dm.missions
                  const rewards     = scaledMissionRewards(m)
                  const sub         = cardSubtitle(m.description)
                  return (
                    <div
                      key={dm.id}
                      className={[
                        'bg-white rounded-2xl p-4 shadow-sm border-2 transition-all',
                        isCompleted ? 'border-brand-green/40 opacity-75' : 'border-transparent',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        {/* 아이콘 */}
                        <MissionIconBlock
                          completed={isCompleted}
                          iconEmoji={m.icon_emoji}
                          title={m.title}
                          completedBgClass="bg-brand-green/20"
                          idleBgClass="bg-sky-50"
                        />

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold text-sm ${isCompleted ? 'line-through text-gray-400' : 'text-brand-text'}`}>
                              {m.title}
                            </p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLOR[m.difficulty] ?? 'bg-gray-100 text-gray-500'}`}>
                              {DIFFICULTY_LABEL[m.difficulty]}
                            </span>
                            {timeLabel && (
                              <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">
                                {timeLabel}
                              </span>
                            )}
                          </div>
                          {sub && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{sub}</p>
                          )}

                          {/* 보상 — 부모가 설정한 배율(스페셜)이 있으면 크레딧·하트·EXP 모두 곱해 표시 */}
                          <div className="mt-2 flex items-center gap-2">
                            <RewardBadge kind="credit" value={rewards.credit} />
                            {rewards.heart > 0 && <RewardBadge kind="heart" value={rewards.heart} />}
                            <RewardBadge kind="exp" value={rewards.exp} />
                          </div>
                        </div>

                        {/* 완료 버튼 */}
                        <button
                          onClick={() => handleComplete(dm)}
                          disabled={isCompleted || isLoading !== false}
                          className={[
                            'flex-shrink-0 ml-1 text-sm font-bold px-3 py-2 rounded-xl transition-all active:scale-95',
                            isCompleted
                              ? 'bg-brand-green/20 text-brand-green cursor-default'
                              : isLoading
                                ? 'bg-gray-100 text-gray-400 cursor-wait'
                                : 'bg-brand-blue text-white shadow-md hover:bg-blue-600',
                          ].join(' ')}
                        >
                          {isCompleted ? '완료!' : isLoading ? '…' : '완료'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {specialRows.length > 0 && (
            <div>
              <p className="mb-2 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text px-1 text-xs font-black text-transparent">
                스페셜 미션
              </p>
              <div className="flex flex-col gap-3">
                {specialRows.map((dm) => {
                  const isCompleted = done.has(dm.id)
                  const isLoading = loading === dm.id
                  const timeLabel = formatTime(dm.scheduled_time)
                  const m = dm.missions
                  const rewards = scaledMissionRewards(m)
                  return (
                    <div
                      key={dm.id}
                      className={[
                        'rounded-2xl border-2 p-4 shadow-md transition-all',
                        isCompleted
                          ? 'border-amber-300/50 bg-amber-50/40 opacity-75'
                          : 'border-amber-400/90 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 shadow-amber-300/30 ring-1 ring-amber-300/50',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <MissionIconBlock
                          completed={isCompleted}
                          iconEmoji={m.icon_emoji}
                          title={m.title}
                          completedBgClass="bg-amber-100/80"
                          idleBgClass="bg-gradient-to-br from-yellow-200 to-amber-300 shadow-inner"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`text-sm font-bold ${isCompleted ? 'text-gray-400 line-through' : 'text-amber-950'}`}
                            >
                              {m.title}
                            </p>
                            {timeLabel ? (
                              <span className="rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                {timeLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <RewardBadge kind="credit" value={rewards.credit} />
                            {rewards.heart > 0 && <RewardBadge kind="heart" value={rewards.heart} />}
                            <RewardBadge kind="exp" value={rewards.exp} />
                          </div>
                          {rewards.mult > 1 ? (
                            <p className="mt-1 text-[10px] font-bold text-amber-800">보상 {rewards.mult}배 적용 중</p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => handleComplete(dm)}
                          disabled={isCompleted || isLoading !== false}
                          className={[
                            'ml-1 flex-shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition-all active:scale-95',
                            isCompleted
                              ? 'cursor-default bg-amber-200/50 text-amber-800'
                              : isLoading
                                ? 'cursor-wait bg-gray-100 text-gray-400'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md hover:from-amber-600 hover:to-yellow-600',
                          ].join(' ')}
                        >
                          {isCompleted ? '완료!' : isLoading ? '…' : '완료'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 전체 완료 축하 */}
      {total > 0 && completedCount === total && (
        <div className="rounded-2xl border-2 border-brand-yellow bg-brand-yellow/30 p-5 text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">축하해요</p>
          <p className="font-black text-brand-text">오늘 미션 모두 완료!</p>
          <p className="mt-1 text-sm text-gray-500">정말 대단해요! 내일도 화이팅.</p>
        </div>
      )}
    </div>
  )
}

function MissionIconBlock({
  completed,
  iconEmoji,
  title,
  completedBgClass,
  idleBgClass,
}: {
  completed: boolean
  iconEmoji: string | null | undefined
  title: string
  completedBgClass: string
  idleBgClass: string
}) {
  const base = 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl'
  if (completed) {
    return (
      <div className={`${base} text-[10px] font-black text-brand-green ${completedBgClass}`}>완료</div>
    )
  }
  const e = iconEmoji?.trim()
  if (e) {
    return (
      <div className={`${base} text-2xl leading-none ${idleBgClass}`} aria-hidden>
        {e}
      </div>
    )
  }
  return (
    <div className={`${base} text-sm font-black text-sky-700 ${idleBgClass}`}>{title.slice(0, 1)}</div>
  )
}

function RewardBadge({ kind, value }: { kind: 'credit' | 'heart' | 'exp'; value: number }) {
  const label = kind === 'credit' ? '크레딧' : kind === 'heart' ? '하트' : 'EXP'
  const display = kind === 'exp' ? `+${value}` : value
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-bold text-gray-600">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span>{display}</span>
    </span>
  )
}
