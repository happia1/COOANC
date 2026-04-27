/**
 * 루틴 알람(기상·하원·취침) — 온보딩·상단 시트·키워드 추가가 같은 값을 씁니다.
 * - 알림 on/off: cooanc_notify_wake | return | sleep ('1' / '0')
 * - 시각·소리·주말 울림·추가 일정: cooanc_alarm_prefs JSON
 */

import { DEFAULT_ROUTINE_ALARM_SOUND_IDS } from '@/lib/routineAlarmSounds'

export type RoutineCustomAlarmStored = {
  id: string
  label: string
  time: string
  notify: boolean
  soundFile: string
  /** 주말에도 울림 — JSON에 없으면 true 로 간주 */
  onWeekend?: boolean
}

export type RoutineAlarmPrefsJson = {
  wake: string
  return: string
  sleep: string
  wakeTime?: string
  returnHomeTime?: string
  sleepTime?: string
  /** 잘 준비 알림 시각 HH:MM — child_stats.sleep_ready_time 과 함께 쓰기 위해 로컬에도 보관 */
  sleepReadyTime?: string
  /** 등원 알람 — 시각·소리·주중/주말·전체 사용 (소리 id 는 알람 음원 목록) */
  school?: string
  schoolTime?: string
  schoolEnabled?: boolean
  schoolWeekday?: boolean
  schoolWeekend?: boolean
  soundSleepReady?: string
  sleepReadyEnabled?: boolean
  sleepReadyWeekday?: boolean
  sleepReadyWeekend?: boolean
  custom?: RoutineCustomAlarmStored[]
  /** 토·일(및 앱에서 주말로 보는 날)에도 해당 알림을 울릴지 — 없으면 true(기존 동작) */
  wakeOnWeekend?: boolean
  returnOnWeekend?: boolean
  sleepOnWeekend?: boolean
}

const DEFAULTS = {
  wakeTime: '07:00',
  returnHomeTime: '15:00',
  sleepTime: '21:00',
  sleepReadyTime: '20:30',
  schoolTime: '08:30',
} as const

/** 루틴 탭에서 선택한 자녀의 기관 여부(하원·귀가 행 표시용) */
export const ROUTINE_HAS_SCHOOL_KEY = 'cooanc_routine_has_school'

export function readRoutineHasSchoolFromStorage(): boolean {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(ROUTINE_HAS_SCHOOL_KEY)
  if (v === '0') return false
  if (v === '1') return true
  return true
}

export type RoutineAlarmPrefsLoaded = {
  notifyWake: boolean
  notifyReturn: boolean
  notifySleep: boolean
  wakeTime: string
  returnHomeTime: string
  sleepTime: string
  soundWake: string
  soundReturn: string
  soundSleep: string
  customAlarms: RoutineCustomAlarmStored[]
  wakeOnWeekend: boolean
  returnOnWeekend: boolean
  sleepOnWeekend: boolean
  /** 잘 준비 알림 시각 (HH:MM) */
  sleepReadyTime: string
  soundSleepReady: string
  sleepReadyEnabled: boolean
  sleepReadyWeekday: boolean
  sleepReadyWeekend: boolean
  schoolTime: string
  soundSchool: string
  schoolEnabled: boolean
  schoolWeekday: boolean
  schoolWeekend: boolean
}

function parsePrefsJson(raw: string | null): Partial<RoutineAlarmPrefsJson> {
  if (!raw?.trim()) return {}
  try {
    return JSON.parse(raw) as RoutineAlarmPrefsJson
  } catch {
    return {}
  }
}

/** 화면·API 호출용으로 한 번에 읽기 */
export function readRoutineAlarmPrefs(): RoutineAlarmPrefsLoaded {
  const empty: RoutineAlarmPrefsLoaded = {
    notifyWake: true,
    notifyReturn: true,
    notifySleep: true,
    wakeTime: DEFAULTS.wakeTime,
    returnHomeTime: DEFAULTS.returnHomeTime,
    sleepTime: DEFAULTS.sleepTime,
    soundWake: DEFAULT_ROUTINE_ALARM_SOUND_IDS.wake,
    soundReturn: DEFAULT_ROUTINE_ALARM_SOUND_IDS.returnHome,
    soundSleep: DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleep,
    customAlarms: [],
    wakeOnWeekend: true,
    returnOnWeekend: true,
    sleepOnWeekend: true,
    sleepReadyTime: DEFAULTS.sleepReadyTime,
    soundSleepReady: DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleepReady,
    sleepReadyEnabled: true,
    sleepReadyWeekday: true,
    sleepReadyWeekend: true,
    schoolTime: DEFAULTS.schoolTime,
    soundSchool: DEFAULT_ROUTINE_ALARM_SOUND_IDS.school,
    schoolEnabled: true,
    schoolWeekday: true,
    schoolWeekend: true,
  }
  if (typeof window === 'undefined') return empty

  /** JSON 에 소리 id 가 비어 있으면 항목별 기본 id 로 채웁니다(첫 설치·구버전 호환). */
  const coalesceSound = (raw: unknown, fallback: string) =>
    typeof raw === 'string' && raw.trim() ? raw.trim() : fallback

  const nw = localStorage.getItem('cooanc_notify_wake')
  const nr = localStorage.getItem('cooanc_notify_return')
  const ns = localStorage.getItem('cooanc_notify_sleep')
  const j = parsePrefsJson(localStorage.getItem('cooanc_alarm_prefs'))

  const wakeTime =
    typeof j.wakeTime === 'string' && /^\d{2}:\d{2}$/.test(j.wakeTime) ? j.wakeTime : DEFAULTS.wakeTime
  const returnHomeTime =
    typeof j.returnHomeTime === 'string' && /^\d{2}:\d{2}$/.test(j.returnHomeTime)
      ? j.returnHomeTime
      : DEFAULTS.returnHomeTime
  const sleepTime =
    typeof j.sleepTime === 'string' && /^\d{2}:\d{2}$/.test(j.sleepTime) ? j.sleepTime : DEFAULTS.sleepTime
  const sleepReadyTimeRaw = typeof j.sleepReadyTime === 'string' ? j.sleepReadyTime : ''
  const sleepReadyTime =
    /^\d{1,2}:\d{2}$/.test(sleepReadyTimeRaw)
      ? (() => {
          const [hh, mm] = sleepReadyTimeRaw.split(':')
          return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
        })()
      : DEFAULTS.sleepReadyTime

  const schoolTimeRaw = typeof j.schoolTime === 'string' ? j.schoolTime : ''
  const schoolTime =
    /^\d{1,2}:\d{2}$/.test(schoolTimeRaw)
      ? (() => {
          const [hh, mm] = schoolTimeRaw.split(':')
          return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
        })()
      : DEFAULTS.schoolTime

  const sleepReadyWeekday = typeof j.sleepReadyWeekday === 'boolean' ? j.sleepReadyWeekday : true
  const sleepReadyWeekend = typeof j.sleepReadyWeekend === 'boolean' ? j.sleepReadyWeekend : true
  const schoolWeekday = typeof j.schoolWeekday === 'boolean' ? j.schoolWeekday : true
  const schoolWeekend = typeof j.schoolWeekend === 'boolean' ? j.schoolWeekend : true

  return {
    notifyWake: nw === null ? true : nw === '1',
    notifyReturn: nr === null ? true : nr === '1',
    notifySleep: ns === null ? true : ns === '1',
    wakeTime,
    returnHomeTime,
    sleepTime,
    soundWake: coalesceSound(j.wake, DEFAULT_ROUTINE_ALARM_SOUND_IDS.wake),
    soundReturn: coalesceSound(j.return, DEFAULT_ROUTINE_ALARM_SOUND_IDS.returnHome),
    soundSleep: coalesceSound(j.sleep, DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleep),
    customAlarms: Array.isArray(j.custom)
      ? j.custom.map((raw) => {
          const c = raw as RoutineCustomAlarmStored
          return {
            ...c,
            onWeekend: typeof c.onWeekend === 'boolean' ? c.onWeekend : true,
          }
        })
      : [],
    wakeOnWeekend: typeof j.wakeOnWeekend === 'boolean' ? j.wakeOnWeekend : true,
    returnOnWeekend: typeof j.returnOnWeekend === 'boolean' ? j.returnOnWeekend : true,
    sleepOnWeekend: typeof j.sleepOnWeekend === 'boolean' ? j.sleepOnWeekend : true,
    sleepReadyTime,
    soundSleepReady: coalesceSound(j.soundSleepReady, DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleepReady),
    sleepReadyWeekday,
    sleepReadyWeekend,
    sleepReadyEnabled: sleepReadyWeekday || sleepReadyWeekend,
    schoolTime,
    soundSchool: coalesceSound(j.school, DEFAULT_ROUTINE_ALARM_SOUND_IDS.school),
    schoolWeekday,
    schoolWeekend,
    schoolEnabled: schoolWeekday || schoolWeekend,
  }
}

/** 알람 시트·온보딩 완료 시 저장 */
export function writeRoutineAlarmPrefs(p: RoutineAlarmPrefsLoaded): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('cooanc_notify_wake', p.notifyWake ? '1' : '0')
  localStorage.setItem('cooanc_notify_return', p.notifyReturn ? '1' : '0')
  localStorage.setItem('cooanc_notify_sleep', p.notifySleep ? '1' : '0')
  const payload: RoutineAlarmPrefsJson = {
    wake: p.soundWake,
    return: p.soundReturn,
    sleep: p.soundSleep,
    wakeTime: p.wakeTime,
    returnHomeTime: p.returnHomeTime,
    sleepTime: p.sleepTime,
    custom: p.customAlarms,
    wakeOnWeekend: p.wakeOnWeekend,
    returnOnWeekend: p.returnOnWeekend,
    sleepOnWeekend: p.sleepOnWeekend,
    sleepReadyTime: p.sleepReadyTime,
    soundSleepReady: p.soundSleepReady,
    sleepReadyEnabled: p.sleepReadyEnabled,
    sleepReadyWeekday: p.sleepReadyWeekday,
    sleepReadyWeekend: p.sleepReadyWeekend,
    schoolTime: p.schoolTime,
    school: p.soundSchool,
    schoolEnabled: p.schoolEnabled,
    schoolWeekday: p.schoolWeekday,
    schoolWeekend: p.schoolWeekend,
  }
  localStorage.setItem('cooanc_alarm_prefs', JSON.stringify(payload))
}
