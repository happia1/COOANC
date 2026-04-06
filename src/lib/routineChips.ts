/**
 * 온보딩·루틴 탭 공통 — 키워드 칩 정의와 /api/mission/create 연속 호출
 */

import type { Mission } from '@/types/database'
import { isRoutineSectionMission } from '@/lib/specialMissionChips'

export type ApiBlock = 'morning' | 'afternoon' | 'evening' | 'bedtime'
export type ChipType = 'fixed' | 'recommended' | 'optional'

export type ChipDef = {
  id: string
  title: string
  emoji: string
  type: ChipType
  hideWhenNoSchool?: boolean
  apiBlock: ApiBlock
}

export const AM_CHIPS: ChipDef[] = [
  { id: 'am-wake', title: '기상', emoji: '', type: 'fixed', apiBlock: 'morning' },
  { id: 'am-wash', title: '세수', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-brush', title: '양치', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-meal', title: '아침식사', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-water', title: '물마시기', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-dress', title: '옷 갈아입기', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-bag', title: '가방 챙기기', emoji: '', type: 'optional', apiBlock: 'morning' },
  { id: 'am-shoes', title: '신발신기', emoji: '', type: 'optional', apiBlock: 'morning' },
  { id: 'am-school', title: '등원하기', emoji: '', type: 'optional', hideWhenNoSchool: true, apiBlock: 'morning' },
]

export const PM_CHIPS: ChipDef[] = [
  { id: 'pm-hands', title: '손씻기', emoji: '', type: 'recommended', apiBlock: 'afternoon' },
  { id: 'pm-snack', title: '간식먹기', emoji: '', type: 'recommended', apiBlock: 'afternoon' },
  { id: 'pm-water', title: '물마시기', emoji: '', type: 'recommended', apiBlock: 'afternoon' },
  { id: 'pm-out', title: '야외놀이', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-in', title: '실내놀이', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-read', title: '독서활동', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-puzzle', title: '퍼즐놀이', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-art', title: '미술놀이', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-hw', title: '숙제하기', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-dinner', title: '저녁식사', emoji: '', type: 'recommended', apiBlock: 'evening' },
  { id: 'pm-tidy', title: '모두 제자리', emoji: '', type: 'recommended', apiBlock: 'evening' },
  { id: 'pm-bath', title: '목욕/샤워', emoji: '', type: 'optional', apiBlock: 'evening' },
  { id: 'pm-face', title: '잠자리 세수', emoji: '', type: 'recommended', apiBlock: 'bedtime' },
  { id: 'pm-brush', title: '잠자리 양치', emoji: '', type: 'recommended', apiBlock: 'bedtime' },
  { id: 'pm-pajama', title: '잠옷 갈아입기', emoji: '', type: 'recommended', apiBlock: 'bedtime' },
  { id: 'pm-bedread', title: '잠자리 독서', emoji: '', type: 'optional', apiBlock: 'bedtime' },
  { id: 'pm-sleep', title: '취침', emoji: '', type: 'fixed', apiBlock: 'bedtime' },
]

/** 기상 → 취침 순서(오전 칩 먼저, 이어서 오후~취침) — 정렬 시 같은 제목(물마시기 등)은 block 으로 구분 */
const ALL_ROUTINE_FLOW_CHIPS: ChipDef[] = [...AM_CHIPS, ...PM_CHIPS]

/** 미션 정렬용 최소 필드( DB Mission 과 호환 ) */
export type RoutineFlowSortable = {
  title: string
  block: string | null
  scheduled_time: string | null
}

function minutesFromHHMMSafe(t: string | null | undefined): number {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return 24 * 60
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
}

/**
 * 기상부터 취침까지 일상 루틴에 맞는 순서 점수(작을수록 앞).
 * 제목이 칩과 같으면 칩 순서를 쓰고, 아니면 block·시간으로 뒤에 배치합니다.
 */
export function routineMissionFlowRank(m: RoutineFlowSortable): number {
  const title = m.title.trim()
  const candidates = ALL_ROUTINE_FLOW_CHIPS.map((c, i) => ({ c, i })).filter((x) => x.c.title === title)
  if (candidates.length > 0) {
    if (candidates.length > 1 && m.block) {
      const exact = candidates.find((x) => x.c.apiBlock === m.block)
      if (exact) return exact.i
    }
    return candidates[0].i
  }
  const blockOrder: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, bedtime: 3 }
  const b = m.block && m.block in blockOrder ? blockOrder[m.block] : 4
  return 1000 + b * 500 + minutesFromHHMMSafe(m.scheduled_time)
}

/** 기상 → 취침 흐름으로 미션 배열 정렬 */
export function sortMissionsByRoutineFlow<T extends RoutineFlowSortable>(missions: T[]): T[] {
  return [...missions].sort((a, b) => {
    const d = routineMissionFlowRank(a) - routineMissionFlowRank(b)
    if (d !== 0) return d
    const td = minutesFromHHMMSafe(a.scheduled_time) - minutesFromHHMMSafe(b.scheduled_time)
    if (td !== 0) return td
    return a.title.localeCompare(b.title, 'ko')
  })
}

/** 키워드 칩 제목 집합 — 삭제·동기화 시 이 제목의 daily/weekly 템플릿만 정리 */
export const ROUTINE_KEYWORD_CHIP_TITLES: string[] = [...AM_CHIPS, ...PM_CHIPS].map((c) => c.title)

export function defaultSelectedIds(pool: ChipDef[], forSchool: boolean): string[] {
  return pool
    .filter((c) => (!c.hideWhenNoSchool || forSchool) && (c.type === 'fixed' || c.type === 'recommended'))
    .map((c) => c.id)
}

export function toggleChipId(pool: ChipDef[], selectedIds: string[], id: string, isFixed: boolean): string[] {
  if (isFixed) return selectedIds
  const set = new Set(selectedIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return pool.filter((c) => set.has(c.id)).map((c) => c.id)
}

/** 기상·취침 등 고정 칩도 끄고 켤 수 있게(루틴 시트 DB 동기화용) */
export function toggleChipIdLoose(pool: ChipDef[], selectedIds: string[], id: string): string[] {
  const set = new Set(selectedIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return pool.filter((c) => set.has(c.id)).map((c) => c.id)
}

/**
 * 자녀에게 이미 있는 일상(키워드) 미션 → 시트 칩·휴일 모드 초기값.
 * 활성(is_active)인 행만 칩에 체크, 주간(weekly) 행이 하나라도 있으면 「휴일만 따로」로 봅니다.
 */
export function deriveRoutineKeywordUiState(params: {
  missions: Mission[]
  childId: string | null
  hasSchool: boolean
}): {
  weekdayAm: string[]
  weekdayPm: string[]
  holidayAm: string[]
  holidayPm: string[]
  holidayRoutineMode: 'as_weekday' | 'custom'
} {
  const { hasSchool } = params
  if (!params.childId) {
    return {
      weekdayAm: defaultSelectedIds(AM_CHIPS, hasSchool),
      weekdayPm: defaultSelectedIds(PM_CHIPS, hasSchool),
      holidayAm: defaultSelectedIds(AM_CHIPS, false),
      holidayPm: defaultSelectedIds(PM_CHIPS, false),
      holidayRoutineMode: 'as_weekday',
    }
  }

  const routine = params.missions.filter(
    (m) => m.linked_child_id === params.childId && isRoutineSectionMission(m),
  )

  if (routine.length === 0) {
    return {
      weekdayAm: defaultSelectedIds(AM_CHIPS, hasSchool),
      weekdayPm: defaultSelectedIds(PM_CHIPS, hasSchool),
      holidayAm: defaultSelectedIds(AM_CHIPS, false),
      holidayPm: defaultSelectedIds(PM_CHIPS, false),
      holidayRoutineMode: 'as_weekday',
    }
  }

  const daily = routine.filter((m) => m.repeat_type === 'daily')
  const weekly = routine.filter((m) => m.repeat_type === 'weekly')

  const dailyActiveTitles = new Set(daily.filter((m) => m.is_active).map((m) => m.title.trim()))
  const weeklyActiveTitles = new Set(weekly.filter((m) => m.is_active).map((m) => m.title.trim()))

  const weekdayAm = AM_CHIPS.filter(
    (c) => dailyActiveTitles.has(c.title) && (!c.hideWhenNoSchool || hasSchool),
  ).map((c) => c.id)
  const weekdayPm = PM_CHIPS.filter((c) => dailyActiveTitles.has(c.title)).map((c) => c.id)

  const hasWeekly = weekly.length > 0
  const holidayRoutineMode: 'as_weekday' | 'custom' = hasWeekly ? 'custom' : 'as_weekday'
  const holidayAm = hasWeekly
    ? AM_CHIPS.filter((c) => weeklyActiveTitles.has(c.title)).map((c) => c.id)
    : defaultSelectedIds(AM_CHIPS, false)
  const holidayPm = hasWeekly
    ? PM_CHIPS.filter((c) => weeklyActiveTitles.has(c.title)).map((c) => c.id)
    : defaultSelectedIds(PM_CHIPS, false)

  return { weekdayAm, weekdayPm, holidayAm, holidayPm, holidayRoutineMode }
}

function minutesFromHHMM(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

function blockFromTimeHHMM(t: string): ApiBlock {
  const h = Math.floor(minutesFromHHMM(t) / 60)
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'bedtime'
}

function alarmDescription(alarmFile: string | null | undefined): string | null {
  if (!alarmFile?.trim()) return null
  return JSON.stringify({ v: 1 as const, alarmFile: alarmFile.trim() })
}

function scheduledTimeForChip(
  chip: ChipDef,
  opts: {
    selPmIds: string[]
    wake: string
    sleep: string
    returnAnchor: string
    hasSchool: boolean
    notifyWake: boolean
    notifyReturn: boolean
    notifySleep: boolean
  },
): string | null {
  if (chip.title === '기상') {
    return opts.notifyWake && /^\d{2}:\d{2}$/.test(opts.wake) ? opts.wake : null
  }
  if (chip.title === '취침') {
    return opts.notifySleep && /^\d{2}:\d{2}$/.test(opts.sleep) ? opts.sleep : null
  }
  const firstPm = opts.selPmIds[0]
  if (opts.hasSchool && firstPm && chip.id === firstPm) {
    const a = opts.returnAnchor.trim()
    return opts.notifyReturn && /^\d{2}:\d{2}$/.test(a) ? a : null
  }
  return null
}

function missionDescriptionForChip(
  chip: ChipDef,
  pmIds: string[],
  soundWake: string,
  soundReturn: string,
  soundSleep: string,
  hasSchool: boolean,
): string | null {
  if (chip.title === '기상') return alarmDescription(soundWake)
  if (chip.title === '취침') return alarmDescription(soundSleep)
  const firstPm = pmIds[0]
  if (hasSchool && firstPm && chip.id === firstPm) return alarmDescription(soundReturn)
  return null
}

export type CustomAlarmRow = {
  id: string
  label: string
  time: string
  notify: boolean
  soundFile: string
}

type CreateCtx = {
  wakeTime: string
  sleepTime: string
  returnAnchor: string
  hasSchool: boolean
  notifyWake: boolean
  notifyReturn: boolean
  notifySleep: boolean
  soundWake: string
  soundReturn: string
  soundSleep: string
}

async function createMissionsFromIds(
  fetchApi: typeof fetch,
  amIds: string[],
  pmIds: string[],
  repeatType: 'daily' | 'weekly',
  linkedChildId: string,
  hasSchoolForAnchor: boolean,
  customs: CustomAlarmRow[],
  ctx: CreateCtx,
): Promise<void> {
  const ordered: ChipDef[] = [
    ...AM_CHIPS.filter((c) => amIds.includes(c.id)),
    ...PM_CHIPS.filter((c) => pmIds.includes(c.id)),
  ]

  for (const chip of ordered) {
    const time = scheduledTimeForChip(chip, {
      selPmIds: pmIds,
      wake: ctx.wakeTime,
      sleep: ctx.sleepTime,
      returnAnchor: ctx.returnAnchor,
      hasSchool: hasSchoolForAnchor,
      notifyWake: ctx.notifyWake,
      notifyReturn: ctx.notifyReturn,
      notifySleep: ctx.notifySleep,
    })
    const description = missionDescriptionForChip(
      chip,
      pmIds,
      ctx.soundWake,
      ctx.soundReturn,
      ctx.soundSleep,
      hasSchoolForAnchor,
    )
    const res = await fetchApi('/api/mission/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: chip.title,
        description,
        icon_emoji: chip.emoji.trim() || '·',
        block: chip.apiBlock,
        scheduled_time: time,
        credit_reward: 10,
        exp_reward: 10,
        heart_reward: 0,
        difficulty: 'easy',
        repeat_type: repeatType,
        level_required: 0,
        linked_child_id: linkedChildId,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(typeof j.error === 'string' ? j.error : '미션 생성 실패')
    }
  }

  if (repeatType === 'daily' && customs.length > 0) {
    const sortedCustom = [...customs].sort(
      (a, b) => minutesFromHHMM(a.time) - minutesFromHHMM(b.time) || a.id.localeCompare(b.id),
    )
    for (const a of sortedCustom) {
      const t = a.notify && /^\d{2}:\d{2}$/.test(a.time) ? a.time : null
      const block = blockFromTimeHHMM(a.time)
      const description = alarmDescription(a.soundFile)
      const res = await fetchApi('/api/mission/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: a.label.trim(),
          description,
          icon_emoji: '·',
          block,
          scheduled_time: t,
          credit_reward: 10,
          exp_reward: 10,
          heart_reward: 0,
          difficulty: 'easy',
          repeat_type: 'daily',
          level_required: 0,
          linked_child_id: linkedChildId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j.error === 'string' ? j.error : '미션 생성 실패')
      }
    }
  }
}

/** 루틴 탭·온보딩 공통: 선택한 칩으로 자녀 연결 미션을 만듭니다. */
export async function postRoutineKeywordMissions(
  fetchApi: typeof fetch,
  input: {
    linkedChildId: string
    weekdayAm: string[]
    weekdayPm: string[]
    holidayMode: 'as_weekday' | 'custom'
    holidayAm: string[]
    holidayPm: string[]
    hasSchool: boolean
    wakeTime: string
    sleepTime: string
    returnHomeTime: string
    notifyWake: boolean
    notifyReturn: boolean
    notifySleep: boolean
    soundWake: string
    soundReturn: string
    soundSleep: string
    customAlarms?: CustomAlarmRow[]
  },
): Promise<void> {
  /** 같은 자녀의 키워드 루틴(daily/weekly 칩 제목)만 먼저 지우고 다시 만들어 중복·충돌 방지 */
  const wipe = await fetchApi('/api/mission/delete-keyword-routine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId: input.linkedChildId }),
  })
  if (!wipe.ok) {
    const j = await wipe.json().catch(() => ({}))
    throw new Error(typeof j.error === 'string' ? j.error : '기존 키워드 루틴을 정리하지 못했어요')
  }

  const returnAnchor = /^\d{2}:\d{2}$/.test(input.returnHomeTime.trim())
    ? input.returnHomeTime.trim()
    : '15:00'
  const ctx: CreateCtx = {
    wakeTime: input.wakeTime,
    sleepTime: input.sleepTime,
    returnAnchor,
    hasSchool: input.hasSchool,
    notifyWake: input.notifyWake,
    notifyReturn: input.notifyReturn,
    notifySleep: input.notifySleep,
    soundWake: input.soundWake,
    soundReturn: input.soundReturn,
    soundSleep: input.soundSleep,
  }

  await createMissionsFromIds(
    fetchApi,
    input.weekdayAm,
    input.weekdayPm,
    'daily',
    input.linkedChildId,
    input.hasSchool,
    input.customAlarms ?? [],
    ctx,
  )

  if (input.holidayMode === 'custom') {
    await createMissionsFromIds(
      fetchApi,
      input.holidayAm,
      input.holidayPm,
      'weekly',
      input.linkedChildId,
      false,
      [],
      ctx,
    )
  }
}
