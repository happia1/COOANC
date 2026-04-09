/**
 * 루틴 탭 — 스페셜(이벤트성) 미션 키워드 칩 정의
 * - 「데일리 설정」이면 repeat_type: daily + difficulty: special (자녀 앱에서 매일 오늘 카드에 포함)
 * - 끄면 repeat_type: event + 오늘 배정 API로 하루만 넣기
 */

import type { Mission } from '@/types/database'

/** 칩 한 줄 정의 */
export type SpecialMissionChipDef = {
  id: string
  title: string
  emoji: string
  /** 자녀 팝업에 넣을 기본 한 줄 (없으면 제목만 씀) */
  defaultPopupMessage: string
}

/** 부모가 고를 수 있는 스페셜 키워드 목록 (제목은 카드·칩에 짧게 표시) */
export const SPECIAL_MISSION_CHIPS: SpecialMissionChipDef[] = [
  {
    id: 'sp-meal',
    title: '식사준비',
    emoji: '🥗',
    defaultPopupMessage: '식사 준비를 함께 도와주어요.',
  },
  {
    id: 'sp-greet',
    title: '인사잘하기',
    emoji: '🙋',
    defaultPopupMessage: '오늘은 밝게 인사해 보아요!',
  },
  {
    id: 'sp-massage',
    title: '어깨마사지',
    emoji: '💆',
    defaultPopupMessage: '부모님 어깨를 살살 주물러 드려요.',
  },
  {
    id: 'sp-recycle',
    title: '분리수거',
    emoji: '♻️',
    defaultPopupMessage: '분리수거를 정확히 해보아요.',
  },
  {
    id: 'sp-exercise',
    title: '운동하기',
    emoji: '🏃',
    defaultPopupMessage: '오늘은 몸을 조금 움직여 보아요!',
  },
  {
    id: 'sp-veggies',
    title: '야채먹기',
    emoji: '🥬',
    defaultPopupMessage: '야채를 맛있게 먹어 보아요.',
  },
  {
    id: 'sp-finish-meal',
    title: '식사후 정리',
    emoji: '🍽️',
    defaultPopupMessage: '식사가 끝나면 자리와 그릇을 정리해요.',
  },
  {
    id: 'sp-laundry-basket',
    title: '빨래통에 넣기',
    emoji: '🧺',
    defaultPopupMessage: '입었던 옷을 빨래통에 넣어 두어요.',
  },
  {
    id: 'sp-laundry-tidy',
    title: '외투 걸어두기',
    emoji: '🧥',
    defaultPopupMessage: '다녀온 외투를 옷걸이나 지정한 곳에 걸어 두어요.',
  },
  {
    id: 'sp-bag-tidy',
    title: '가방정리하기',
    emoji: '🎒',
    defaultPopupMessage: '가방 안을 깔끔하게 정리해요.',
  },
  {
    id: 'sp-nails',
    title: '손톱깎기',
    emoji: '✂️',
    defaultPopupMessage: '손톱을 깔끔하게 다듬어요.',
  },
]

/**
 * 예전에 저장된 미션 제목 → 현재 칩 제목(표시·매칭용)
 * DB에 옛 짧은 이름(인사, 어깨)이 남아 있어도 시트·카드에서 새 이름으로 이어집니다.
 */
const LEGACY_SPECIAL_TITLE_TO_SHORT: Record<string, string> = {
  '식사준비 돕기': '식사준비',
  '인사 잘하기': '인사잘하기',
  인사: '인사잘하기',
  '부모님 어깨 주물러드리기': '어깨마사지',
  어깨: '어깨마사지',
  분리수거하기: '분리수거',
  /** 예전 칩 이름 → 지금 시트에 맞는 짧은 제목(썸네일·시트 매칭) */
  '밥 다먹기': '식사후 정리',
  빨래정리: '외투 걸어두기',
  '빨래 정리': '외투 걸어두기',
}

/** 루틴 탭 스페셜 카드 등에 표시할 짧은 제목 */
export function displaySpecialMissionTitle(storedTitle: string): string {
  const t = storedTitle.trim()
  return LEGACY_SPECIAL_TITLE_TO_SHORT[t] ?? t
}

/**
 * 스페셜 칩에서 **완전히 뺀** 미션 제목 — DB 에 옛 템플릿이 남아 있어도 카드·시트에서 숨깁니다.
 * (마이그레이션 `051_remove_retired_special_mission_templates.sql` 로 행 삭제 권장)
 */
const RETIRED_SPECIAL_DISPLAY_TITLES = new Set<string>([
  '설거지',
  '방청소',
  '심부름',
  '심부름하기',
  '방 청소하기',
  '골고루먹기',
])

/** 저장된 제목이 폐지된 스페셜 키워드인지 (레거시 별칭을 짧은 제목으로 푼 뒤에도 검사) */
export function isRetiredSpecialMissionTitle(storedTitle: string): boolean {
  const raw = storedTitle.trim()
  const resolved = displaySpecialMissionTitle(raw).trim()
  return RETIRED_SPECIAL_DISPLAY_TITLES.has(raw) || RETIRED_SPECIAL_DISPLAY_TITLES.has(resolved)
}

/** 스페셜 UI·자녀 앱 스페셜 구역에 넣을 미션인지 (event 템플릿 또는 매일 자동 스페셜 키워드) */
export function isSpecialSectionMission(m: Pick<Mission, 'repeat_type' | 'difficulty'>): boolean {
  return m.repeat_type === 'event' || (m.repeat_type === 'daily' && m.difficulty === 'special')
}

/** 일상 미션(주중·주말 블록)에 넣을 루틴 템플릿인지 — 스페셜 키워드 데일리는 제외 */
export function isRoutineSectionMission(m: Pick<Mission, 'repeat_type' | 'difficulty'>): boolean {
  if (m.repeat_type === 'event') return false
  if (m.repeat_type === 'daily' && m.difficulty === 'special') return false
  return true
}

/** 스페셜 시트용 — DB에 저장된 제목(레거시 긴 이름 포함)을 칩 id 로 바꿉니다. 없으면 null */
export function missionTitleToSpecialChipId(storedTitle: string): string | null {
  const short = displaySpecialMissionTitle(storedTitle)
  return SPECIAL_MISSION_CHIPS.find((c) => c.title === short)?.id ?? null
}

/**
 * 스페셜 추가 시트를 열 때 — 이 자녀의 스페셜 템플릿을 칩 선택·데일리 체크·저장 시 비교용 베이스라인으로 씁니다.
 * 같은 칩에 행이 여러 개면 첫 행만 씁니다(중복 데이터는 희귀).
 */
export type SpecialMissionSheetBaseline = Record<string, { missionId: string; wasDaily: boolean }>

export function deriveSpecialMissionSheetState(params: {
  missions: Mission[]
  childId: string | null
}): {
  selectedIds: string[]
  dailyAutoIds: string[]
  baseline: SpecialMissionSheetBaseline
} {
  if (!params.childId) {
    return { selectedIds: [], dailyAutoIds: [], baseline: {} }
  }
  const list = params.missions.filter(
    (m) => m.linked_child_id === params.childId && isSpecialSectionMission(m),
  )
  const baseline: SpecialMissionSheetBaseline = {}
  for (const m of list) {
    const chipId = missionTitleToSpecialChipId(m.title)
    if (!chipId || baseline[chipId]) continue
    const wasDaily = m.repeat_type === 'daily' && m.difficulty === 'special'
    baseline[chipId] = { missionId: m.id, wasDaily }
  }
  const selectedIds = Object.keys(baseline)
  const dailyAutoIds = selectedIds.filter((id) => baseline[id].wasDaily)
  return { selectedIds, dailyAutoIds, baseline }
}
