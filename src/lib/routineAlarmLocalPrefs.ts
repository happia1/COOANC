/**
 * 루틴 알람(기상·하원·취침) — 온보딩·상단 시트·키워드 추가가 같은 값을 씁니다.
 * - 알림 on/off: cooanc_notify_wake | return | sleep ('1' / '0')
 * - 시각·소리·주말 울림·추가 일정: cooanc_alarm_prefs JSON
 */

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
    soundWake: '',
    soundReturn: '',
    soundSleep: '',
    customAlarms: [],
    wakeOnWeekend: true,
    returnOnWeekend: true,
    sleepOnWeekend: true,
  }
  if (typeof window === 'undefined') return empty

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

  return {
    notifyWake: nw === null ? true : nw === '1',
    notifyReturn: nr === null ? true : nr === '1',
    notifySleep: ns === null ? true : ns === '1',
    wakeTime,
    returnHomeTime,
    sleepTime,
    soundWake: typeof j.wake === 'string' ? j.wake : '',
    soundReturn: typeof j.return === 'string' ? j.return : '',
    soundSleep: typeof j.sleep === 'string' ? j.sleep : '',
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
  }
  localStorage.setItem('cooanc_alarm_prefs', JSON.stringify(payload))
}
