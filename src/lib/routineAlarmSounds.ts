/**
 * 루틴 알람에서 고를 수 있는 소리 목록과 id → 파일 URL 매핑입니다.
 *
 * 비개발자 설명:
 * - 부모가 알람마다 다른 음원을 고를 때, 내부적으로는 짧은 영문 id(예: morning_greet)를 저장합니다.
 * - 자녀 앱에서 팝업이 뜰 때 이 id를 실제 음원 주소(.wav 파일 경로)로 바꿔 재생합니다.
 * - 예전에 파일 이름만 저장된 데이터도 최대한 같은 소리로 이어지게 처리합니다.
 *
 * 참고: API·컴포넌트에서는 재생 경로 필드 이름을 `url` 로 씁니다(요구사항의 `src` 와 같은 값).
 */

import { CHILD_AUDIO } from '@/lib/childAudio'

/** 알람 소리 한 줄(선택 목록·API 응답과 동일 형태) */
export type RoutineAlarmSoundEntry = {
  id: string
  label: string
  /** 재생에 쓰는 웹 경로 (= 흔히 말하는 src) */
  url: string
}

/**
 * 기본으로 쓰는 알람 소리 id — localStorage 에 값이 없을 때 이 id가 들어갑니다.
 * (RoutineAlarmSettingsSheet 의 행별 defaultSoundId 와 맞춰 두었습니다.)
 * - 기상: 아침인사, 등원: 이제 나갈시간이야, 하원·귀가: tick tock(째깍 타이머), 잘 준비: 잘 준비
 */
export const DEFAULT_ROUTINE_ALARM_SOUND_IDS = {
  wake: 'morning_greet', // 아침인사
  school: 'time_to_go', // 이제 나갈시간이야
  returnHome: 'tick_tock_timer', // tick tock timer (째깍 타이머)
  sleepReady: 'sleep_ready', // 잘 준비
  sleep: 'morning_alarm_birds', // 취침 — 별도 지정이 없으면 기존 기본(아침 새소리) 유지
} as const

/**
 * 부모 화면·API에서 보여 줄 고정 목록(순서 = 기본 노출 순).
 * 효과음 3종 다음에 커스텀 음성 WAV 를 둡니다.
 */
export const ROUTINE_ALARM_SOUND_CATALOG: RoutineAlarmSoundEntry[] = [
  { id: 'morning_alarm_birds', label: '아침 새소리', url: '/assets/audio/alarm/morning_alarm_birds.wav' },
  {
    id: 'morning_alarm_rooster',
    label: '수탉 울음',
    url: '/assets/audio/alarm/morning_alarm-rooster.wav',
  },
  { id: 'tick_tock_timer', label: '째깍 타이머', url: CHILD_AUDIO.tickTock },
  { id: 'morning_greet', label: '아침 인사', url: '/assets/audio/alerts/아침인사.wav' },
  { id: 'good_morning', label: '기분좋게 시작', url: '/assets/audio/alerts/기분좋게 시작.wav' },
  { id: 'sleep_ready', label: '잘 준비', url: '/assets/audio/alerts/잘 준비.wav' },
  { id: 'time_to_go', label: '이제 나갈시간이야', url: '/assets/audio/alerts/이제 나갈시간이야.wav' },
  { id: 'dont_lie', label: '거짓말은 나 속상해', url: CHILD_AUDIO.dontLie },
]

/** id → url 빠른 조회 */
const URL_BY_ID = new Map<string, string>()
/** 예전 데이터: 파일명만 저장된 경우 → url */
const URL_BY_FILENAME = new Map<string, string>()

function registerCatalogAliases(entry: RoutineAlarmSoundEntry) {
  URL_BY_ID.set(entry.id, entry.url)
  const slash = entry.url.lastIndexOf('/')
  const filePart = slash >= 0 ? entry.url.slice(slash + 1) : entry.url
  try {
    const decoded = decodeURIComponent(filePart)
    URL_BY_FILENAME.set(decoded, entry.url)
    URL_BY_FILENAME.set(filePart, entry.url)
  } catch {
    URL_BY_FILENAME.set(filePart, entry.url)
  }
}

for (const e of ROUTINE_ALARM_SOUND_CATALOG) {
  registerCatalogAliases(e)
}

/**
 * 저장된 sound id(또는 예전 방식 파일명)를 실제 재생용 URL로 바꿉니다.
 * - 알 수 없는 값은 예전과 같이 `alarm` 폴더 아래 파일명으로 시도합니다.
 */
export function resolveRoutineAlarmSoundUrl(stored: string): string {
  const t = stored.trim()
  if (!t) {
    return ROUTINE_ALARM_SOUND_CATALOG[0]?.url ?? CHILD_AUDIO.morningGreet
  }
  if (t.startsWith('/assets/') || t.startsWith('http://') || t.startsWith('https://')) {
    return t
  }
  const byId = URL_BY_ID.get(t)
  if (byId) return byId
  const byFile = URL_BY_FILENAME.get(t)
  if (byFile) return byFile
  try {
    const decoded = decodeURIComponent(t)
    const byDecoded = URL_BY_FILENAME.get(decoded)
    if (byDecoded) return byDecoded
  } catch {
    /* 그대로 alarm 경로 시도 */
  }
  return `/assets/audio/alarm/${encodeURIComponent(t)}`
}
