/**
 * 온보딩·루틴 탭 공통 — 키워드 칩 정의와 /api/mission/create 연속 호출
 */

import type { Mission } from '@/types/database'
import { routineMissionIconEmojiForCreate } from '@/lib/routineMissionThumbnail'
import {
  canonicalRoutineChipMatchTitle,
  MISSION_TITLE_ALIASES,
} from '@/lib/routineMissionTitleCanon'
import { isRoutineSectionMission, isSpecialSectionMission } from '@/lib/specialMissionChips'

export { canonicalRoutineChipMatchTitle }

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
  { id: 'am-wash', title: '세수하기', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-brush', title: '양치', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-meal', title: '아침식사', emoji: '', type: 'recommended', apiBlock: 'morning' },
  /** 오전 물마시기 — 썸네일 `a.m/water.png` */
  { id: 'am-water', title: '물마시기', emoji: '', type: 'recommended', apiBlock: 'morning' },
  /** 화장실 다녀오기 */
  { id: 'am-toilet', title: '화장실', emoji: '', type: 'optional', apiBlock: 'morning' },
  /** 마스크 챙기기·착용 */
  { id: 'am-mask', title: '마스크', emoji: '', type: 'optional', apiBlock: 'morning' },
  { id: 'am-dress', title: '옷 갈아입기', emoji: '', type: 'recommended', apiBlock: 'morning' },
  { id: 'am-school', title: '등원하기', emoji: '', type: 'optional', hideWhenNoSchool: true, apiBlock: 'morning' },
]

export const PM_CHIPS: ChipDef[] = [
  { id: 'pm-hands', title: '손씻기', emoji: '', type: 'recommended', apiBlock: 'afternoon' },
  /**
   * 오후·저녁을 한 줄(UI)로 묶되, 오전 「물마시기」와 이름이 겹치지 않게 구분합니다.
   * 예전 DB 에 오후 블록으로 「물마시기」만 적혀 있어도 `canonicalRoutineChipMatchTitle` 로 이 칩에 연결됩니다.
   */
  { id: 'pm-water', title: '저녁 물마시기', emoji: '', type: 'recommended', apiBlock: 'afternoon' },
  { id: 'pm-out', title: '야외놀이', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-in', title: '실내놀이', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-read', title: '독서활동', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-hw', title: '숙제하기', emoji: '', type: 'optional', apiBlock: 'afternoon' },
  { id: 'pm-dinner', title: '저녁식사', emoji: '', type: 'recommended', apiBlock: 'evening' },
  { id: 'pm-tidy', title: '모두 제자리', emoji: '', type: 'recommended', apiBlock: 'evening' },
  /** 샤워만 따로 루틴에 넣을 때 — 썸네일 `p.m/shower.png` (`목욕/샤워` 옛 칩은 별칭으로 여기와 통합) */
  { id: 'pm-shower', title: '샤워하기', emoji: '', type: 'optional', apiBlock: 'evening' },
  { id: 'pm-brush', title: '잠자리 양치', emoji: '', type: 'recommended', apiBlock: 'bedtime' },
  { id: 'pm-pajama', title: '잠옷 갈아입기', emoji: '', type: 'recommended', apiBlock: 'bedtime' },
  { id: 'pm-bedread', title: '잠자리 독서', emoji: '', type: 'optional', apiBlock: 'bedtime' },
  /** 마지막 고정 블록: 침실 — 앱에서는 「잘 시간」으로 안내하지만 과거 DB 에는 「취침」이 남아 있을 수 있습니다. */
  { id: 'pm-sleep', title: '잘 시간', emoji: '', type: 'fixed', apiBlock: 'bedtime' },
]

/** 기상 → 취침 순서(오전 칩 먼저, 이어서 오후~취침). DB 의 afternoon/evening/bedtime 은 한 줄 슬라이더에 함께 보입니다. */
const ALL_ROUTINE_FLOW_CHIPS: ChipDef[] = [...AM_CHIPS, ...PM_CHIPS]

/** 미션 정렬용 최소 필드( DB Mission 과 호환 ) */
export type RoutineFlowSortable = {
  title: string
  block: string | null
  scheduled_time: string | null
  /** 0이면 기본 칩 순서. 부모가 순서를 저장한 뒤에는 10, 20, … 스텝을 씁니다. */
  sort_order?: number | null
}

function minutesFromHHMMSafe(t: string | null | undefined): number {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return 24 * 60
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
}

/**
 * 기상부터 취침까지 일상 루틴에 맞는 순서 점수(작을수록 앞).
 * 제목이 칩과 같으면 칩 순서를 쓰고, 아니면 block·시간으로 뒤에 배치합니다.
 * 별칭 테이블에 있는 제목도 해당 칩의 순위를 받습니다.
 */
export function routineMissionFlowRank(m: RoutineFlowSortable): number {
  const title = canonicalRoutineChipMatchTitle(m)
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

/**
 * `splitMissionsAmPm` 과 동일하게 블록이 없으면 시각으로 오전/오후를 나눕니다.
 * compareRoutineFlowSortable 에서 블록별 묶음 순서를 맞춥니다.
 */
export function routineMissionBlockOrder(m: RoutineFlowSortable): number {
  if (m.block === 'morning') return 0
  if (m.block === 'afternoon') return 1
  if (m.block === 'evening') return 2
  if (m.block === 'bedtime') return 3
  if (m.scheduled_time && /^\d{2}:\d{2}$/.test(m.scheduled_time)) {
    const h = parseInt(m.scheduled_time.slice(0, 2), 10)
    return h < 12 ? 0 : 1
  }
  return 1
}

/**
 * 부모 루틴 탭 `sortMissionsByRoutineFlow` 와 자녀 미션 탭 슬라이더에서 **같은 순서 규칙**을 씁니다.
 * 순서: 시간대(블록 추정) → 부모 지정 sort_order → 칩 순위 → scheduled_time → 제목
 */
export function compareRoutineFlowSortable(a: RoutineFlowSortable, b: RoutineFlowSortable): number {
  const bo = routineMissionBlockOrder(a) - routineMissionBlockOrder(b)
  if (bo !== 0) return bo

  const soA = a.sort_order ?? 0
  const soB = b.sort_order ?? 0
  if (soA !== soB) return soA - soB

  const d = routineMissionFlowRank(a) - routineMissionFlowRank(b)
  if (d !== 0) return d
  const td = minutesFromHHMMSafe(a.scheduled_time) - minutesFromHHMMSafe(b.scheduled_time)
  if (td !== 0) return td
  return a.title.localeCompare(b.title, 'ko')
}

/** 기상 → 취침 흐름으로 미션 배열 정렬 */
export function sortMissionsByRoutineFlow<T extends RoutineFlowSortable>(missions: T[]): T[] {
  return [...missions].sort(compareRoutineFlowSortable)
}

/** 키워드 칩 제목 집합 — 삭제·동기화 시 이 제목의 daily/weekly 템플릿만 정리 */
export const ROUTINE_KEYWORD_CHIP_TITLES: string[] = [...AM_CHIPS, ...PM_CHIPS].map((c) => c.title)

/**
 * 더 이상 노출하지 않는(폐지된) 일상 미션 제목 목록입니다.
 * - 기존 DB 행이 남아 있어도 자녀/부모 앱 카드에서 공통으로 숨기기 위해 사용합니다.
 */
const RETIRED_ROUTINE_MISSION_TITLES = new Set<string>([
  /** `세수하기`로 통일 — 구 템플릿 제목은 카드에서 숨김(065 마이그레이션·DB 삭제과 병행). `간식먹기`는 폐지 목록에서 제거(활성 미션). */
  '세수',
  /** 키워드 칩에서 제거됨 — 남아 있는 템플릿 행은 카드에서 숨김 */
  '가방 챙기기',
])

/** 입력 제목이 폐지된 일상 미션인지 확인합니다. */
export function isRetiredRoutineMissionTitle(title: string | null | undefined): boolean {
  const normalized = (title ?? '').trim()
  if (!normalized) return false
  return RETIRED_ROUTINE_MISSION_TITLES.has(normalized)
}

/**
 * 일상(루틴) `daily_missions` 행만: 제목이 별칭으로 같은 뜻이거나(세수/세수하기),
 * DB 에 제목이 둘 다 `세수하기`로 겹쳐 생긴 중복이면 **한 건만** 남깁니다.
 * 스페셜 미션은 건드리지 않습니다.
 */
export function dedupeDailyRoutineMissionsByCanonicalKey<
  T extends {
    missions: Pick<Mission, 'title' | 'block' | 'repeat_type' | 'difficulty'> | null
  },
>(routineRowsInSortOrder: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of routineRowsInSortOrder) {
    const m = row.missions
    if (!m) {
      out.push(row)
      continue
    }
    if (isSpecialSectionMission(m)) {
      out.push(row)
      continue
    }
    const raw = m.title.trim()
    const canon = MISSION_TITLE_ALIASES[raw] ?? raw
    const key = `${canon}\u0000${m.block ?? ''}\u0000${m.repeat_type}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/**
 * 부모 루틴 탭 `missions` 배열: 자녀 연결 루틴에서 같은 (정규화 제목·block·repeat_type) 이 두 번 이상이면
 * 정렬된 순서에서 앞선 행만 남깁니다(세수/세수하기·이중 `세수하기` 템플릿 정리).
 */
export function dedupeLinkedRoutineMissionsByCanonicalKey(missions: Mission[]): Mission[] {
  const seen = new Set<string>()
  const out: Mission[] = []
  for (const m of missions) {
    if (!isRoutineSectionMission(m)) {
      out.push(m)
      continue
    }
    const raw = m.title.trim()
    const canon = MISSION_TITLE_ALIASES[raw] ?? raw
    const key = `${canon}\u0000${m.block ?? ''}\u0000${m.repeat_type}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out
}

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

  const dailyActiveTitles = new Set(daily.filter((m) => m.is_active).map((m) => canonicalRoutineChipMatchTitle(m)))
  const weeklyActiveTitles = new Set(weekly.filter((m) => m.is_active).map((m) => canonicalRoutineChipMatchTitle(m)))

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
  if (chip.title === '잘 시간' || chip.title === '취침') {
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
  if (chip.title === '잘 시간' || chip.title === '취침') return alarmDescription(soundSleep)
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
        icon_emoji: routineMissionIconEmojiForCreate(chip.title),
        block: chip.apiBlock,
        scheduled_time: time,
        credit_reward: 10,
        exp_reward: 10,
        /** DB 기본(1)과 맞춤 — 0이면 자녀 미션 카드·부모 `하트`와 어긋나 보임 */
        heart_reward: 1,
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
          heart_reward: 1,
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
    const j = (await wipe.json().catch(() => ({}))) as { error?: string; hint?: string }
    const base = typeof j.error === 'string' ? j.error : '기존 키워드 루틴을 정리하지 못했어요'
    const hint = typeof j.hint === 'string' && j.hint.trim() ? `\n\n${j.hint.trim()}` : ''
    throw new Error(`${base}${hint}`)
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

  /**
   * 주말 `daily_missions` 백필 — `custom` + 휴일 weekly 0개 일 때 daily 로 잘못 붙는 문제를 막기 위해
   * `profiles.holiday_routine_mode` 에 의도(평일 동일 / 휴일만 따로)를 남깁니다.
   * 실패해도 키워드 루틴은 이미 반영되었으므로 경고만 합니다.
   */
  const modeRes = await fetchApi('/api/child/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      childId: input.linkedChildId,
      holidayRoutineMode: input.holidayMode,
    }),
  })
  if (!modeRes.ok) {
    const t = await modeRes.text().catch(() => '')
    console.warn('[postRoutineKeywordMissions] holiday_routine_mode 저장 실패', t)
  }
}
