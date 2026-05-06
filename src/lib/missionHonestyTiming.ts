/**
 * 미션 완료 시각 제한 — 자녀가 이른 시간에 오후/취침 미션을 끝내려 할 때
 * (클라이언트 팝업 + API `/api/daily-mission/complete` 가 같은 규칙을 씁니다).
 */

import { getSeoulWeekdayShort } from '@/lib/koreaDate'

/**
 * 미션 행의 block + scheduled_time 만으로 「오후」 여부 판별.
 * `missionAmPm.isAfternoonMission` 과 동일 규칙입니다.
 */
export function isAfternoonMissionFields(
  block: string | null | undefined,
  scheduledTime: string | null | undefined,
): boolean {
  if (block === 'afternoon' || block === 'evening' || block === 'bedtime') return true
  if (block === 'morning') return false
  const hhmm = scheduledTime
  if (!hhmm || hhmm.length < 2) return false
  const hour = Number(hhmm.slice(0, 2))
  return Number.isFinite(hour) && hour >= 12
}

/**
 * 정오(12시) 이전인지 — 서울 `HH:MM` 문자열만 넘깁니다.
 */
export function isSeoulTimeBeforeNoon(seoulHHMM: string): boolean {
  const h = Number(seoulHHMM.slice(0, 2))
  return Number.isFinite(h) && h < 12
}

type SleepReadyFlags = {
  sleepReadyHHMM: string | null
  sleepReadyEnabled: boolean
  sleepReadyWeekday: boolean
  sleepReadyWeekend: boolean
  /** 서울 달력 YYYY-MM-DD (오늘) */
  seoulDateYmd: string
  seoulNowHHMM: string
}

/**
 * `bedtime` 블록 미션을 부모가 정한 「잘 준비」 시각 **이전**에 완료하려는지.
 * - 잘 준비 알람이 꺼져 있거나, 오늘 요일에 잘 준비가 켜져 있지 않으면 제한 없음(거짓말 가드만 하지 않음).
 * - 제한이 켜진 날: 현재 시각이 잘 준비 시각 **미만**이면 true (완료 막기).
 */
export function isBedtimeMissionBlockedBeforeSleepReadyWindow(
  missionBlock: string | null | undefined,
  flags: SleepReadyFlags,
): boolean {
  if (missionBlock !== 'bedtime') return false
  if (!flags.sleepReadyEnabled) return false

  const raw = flags.sleepReadyHHMM?.trim()
  if (!raw || !/^\d{1,2}:\d{2}$/.test(raw)) return false
  const [h, m] = raw.split(':')
  const normReady = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`

  const wd = getSeoulWeekdayShort(flags.seoulDateYmd)
  const isWeekend = wd === '토' || wd === '일'
  const dayAllowed = isWeekend ? flags.sleepReadyWeekend : flags.sleepReadyWeekday
  if (!dayAllowed) return false

  return flags.seoulNowHHMM < normReady
}
