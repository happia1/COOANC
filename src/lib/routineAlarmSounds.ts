/**
 * 루틴 알람에서 고를 수 있는 소리 목록과 id → 파일 URL 매핑입니다.
 *
 * 비개발자 설명:
 * - 부모가 알람마다 다른 음원을 고를 때 화면에는 짧은 한글 이름(예: 「아침 인사」, 「틱톡 타이머」)이 보입니다.
 * - 저장할 때는 짧은 영문 id를 씁니다(예: morning_greet, tick_tock_timer).
 * - 아래 카테고리(기상·등원·취침·기타)는 알림 소리 선택 팝업에서 구역 제목처럼 쓰입니다.
 */

import { AUDIO } from '@/constants/audio'
import { CHILD_AUDIO } from '@/lib/childAudio'

/** 알람 피커에 넣지 않는 파일 이름 — 다른 기능(연속 탭 거절 음 등)만 씁니다(win/mac 한글 이름 NFC·NFD 차이도 걸러요) */
export const ROUTINE_ALARM_SOUND_EXCLUDED_DISK_FILENAMES_NFC = new Set(
  ['거짓말은 나 속상해.wav', 'no.wav'].map((n) => n.normalize('NFC')),
)

/** @deprecated 디스크 스캔용 옛 이름 — `ROUTINE_ALARM_SOUND_EXCLUDED_DISK_FILENAMES_NFC` 사용 권장 */
export const ROUTINE_ALARM_SOUND_EXCLUDED_DISK_FILENAMES = ROUTINE_ALARM_SOUND_EXCLUDED_DISK_FILENAMES_NFC

/** 팝업·API에서 카테고리 블록을 이 순서로 나열합니다 — 기상 → 등원 → 취침 → 기타 */
export const ROUTINE_ALARM_SOUND_CATEGORY_ORDER = ['wake', 'schoolDepart', 'bedtime', 'other'] as const

export type RoutineAlarmSoundCategoryKey = (typeof ROUTINE_ALARM_SOUND_CATEGORY_ORDER)[number]

/** 각 구역 한글 표시 이름 */
export const ROUTINE_ALARM_SOUND_CATEGORY_LABELS_KO: Record<RoutineAlarmSoundCategoryKey, string> = {
  wake: '기상',
  schoolDepart: '등원',
  other: '기타',
  /** 잘 준비·잘 시간 등 저녁·잠 준비 음 묶음(사용자 앱에서는 흔히 「취침 알람」 맥락) */
  bedtime: '취침',
}

/** 알람 소리 한 줄 — 고정 카탈로그·API 행 한 줄 형태 공통입니다 */
export type RoutineAlarmSoundCatalogItem = {
  id: string
  label: string
  /** 재생에 쓰는 웹 주소(브라우저가 그 주소에서 소리 파일을 받아요) */
  url: string
  category: RoutineAlarmSoundCategoryKey
}

/** @deprecated category 없는 구 버전 참조 호환만 — 카탈로그는 모두 RoutineAlarmSoundCatalogItem */
export type RoutineAlarmSoundEntry = RoutineAlarmSoundCatalogItem

/**
 * 기본으로 쓰는 알람 소리 id — 저장값이 없을 때 채워 넣는 기본 선택입니다.
 * (RoutineAlarmSettingsSheet 행별 default 도 여기와 맞춥니다.)
 */
export const DEFAULT_ROUTINE_ALARM_SOUND_IDS = {
  wake: 'morning_greet',
  school: 'time_to_go',
  /** 하원·귀가 기본 알림 소리는 짧은 틱 계열 유지(id는 틱톡 라벨에 대응) */
  returnHome: 'tick_tock_timer',
  sleepReady: 'sleep_ready',
  sleep: 'sleep_time_alert',
} as const

/**
 * 선택 목록에 올 고정 카탈로그 — 순서와 category 가 소리 선택 팝업 블록과 같아야 해요.
 * - 거짓말(no 등) 목록에서는 제외, 예전 저장 id `dont_lie` 는 resolve 시 그대로 재생만 됩니다.
 */
export const ROUTINE_ALARM_SOUND_CATALOG: RoutineAlarmSoundCatalogItem[] = [
  /** 기상: 아침 계열 순서 고정 */
  { id: 'morning_alarm_birds', label: '아침 새소리', url: '/assets/audio/alarm/morning_alarm_birds.wav', category: 'wake' },
  { id: 'morning_greet', label: '아침 인사', url: '/assets/audio/alerts/아침인사.wav', category: 'wake' },
  { id: 'good_morning', label: '기분좋게 시작', url: '/assets/audio/alerts/기분좋게 시작.wav', category: 'wake' },
  {
    id: 'morning_alarm_rooster',
    label: '수탉울음',
    url: '/assets/audio/alarm/morning_alarm-rooster.wav',
    category: 'wake',
  },
  /** 등원 */
  {
    id: 'time_to_go',
    label: '이제 나갈시간이야',
    url: '/assets/audio/alerts/이제 나갈시간이야.wav',
    category: 'schoolDepart',
  },
  /** 기타: 짧은 효과음 둘(서로 다른 파일) */
  { id: 'tick_tock_timer', label: '틱톡 타이머', url: CHILD_AUDIO.tickTock, category: 'other' },
  {
    id: 'alarm_tick_clock',
    label: '째깍 타이머',
    /** 틱톡 WAV 와 같은 파일을 쓰면 소리까지 겹쳐 째깍만 두 줄처럼 느껴져 별 경로 유지 */
    url: AUDIO.ALERTS.JIAGGAK_ROUTINE_TIMER,
    category: 'other',
  },
  /** 취침(잠 준비·잠 시간) */
  { id: 'sleep_ready', label: '잘 준비', url: '/assets/audio/alerts/잘 준비.wav', category: 'bedtime' },
  {
    id: 'sleep_time_alert',
    label: '잘 시간',
    url: '/assets/audio/alerts/잘시간.mp3',
    category: 'bedtime',
  },
]

/** id → url 빠른 조회 */
const URL_BY_ID = new Map<string, string>()
/** 예전 데이터: 파일명만 저장된 경우 → url */
const URL_BY_FILENAME = new Map<string, string>()

function registerCatalogAliases(entry: RoutineAlarmSoundCatalogItem) {
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
 * `/api/assets/alarm-sounds` 등에서 받은 목록을 **알람 선택 팝업용**으로 맞춥니다.
 * - 표시 순서·id·라벨·카테고리는 **항상** `ROUTINE_ALARM_SOUND_CATALOG` 만 따릅니다(API가 레이블을 바꿔 보내도 무시해서 틱톡/째깍 이중 이름 오류가 나지 않게 합니다).
 * - 과거 디스크 스캔 API 대비 타입 호환만 위해 `apiRows` 를 받습니다.
 */
export function mergeRoutineAlarmPickListFromApi(
  apiRows: ReadonlyArray<Partial<{ id: string; label: string; url: string }>> | undefined | null,
): RoutineAlarmSoundCatalogItem[] {
  void apiRows
  return ROUTINE_ALARM_SOUND_CATALOG.map((entry) => ({ ...entry }))
}

/**
 * 저장된 sound id(또는 예전 방식 파일명)를 실제 재생용 URL로 바꿉니다.
 * - 카탈로그에서 빠진 옛 id `dont_lie` 도 예전처럼 재생되도록 직링크를 두었습니다.
 */
export function resolveRoutineAlarmSoundUrl(stored: string): string {
  const t = stored.trim()
  if (!t) {
    return ROUTINE_ALARM_SOUND_CATALOG[0]?.url ?? CHILD_AUDIO.morningGreet
  }
  /** 목록에서는 제외했지만 과거 선택값 호환 — 다른 화면(연속 탭 등)과 같은 파일입니다 */
  if (t === 'dont_lie') return CHILD_AUDIO.dontLie
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
    /* 알수없음 → 아래 폴더 규칙 시도 */
  }
  return `/assets/audio/alarm/${encodeURIComponent(t)}`
}
