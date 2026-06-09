/**
 * 루틴 탭 — 스페셜(이벤트성) 미션 키워드 칩 정의
 * - 「데일리 설정」이면 repeat_type: daily + difficulty: special (자녀 앱에서 매일 오늘 카드에 포함)
 * - 끄면 repeat_type: event + 오늘 배정 API로 하루만 넣기
 * - 칩 옆 그림은 이모지 대신 `routineMissionThumbnail.resolveRoutineMissionPngUrl`(제목 기준 PNG)로 표시합니다.
 */

import type { Mission } from '@/types/database'

/** 칩 한 줄 정의 — `emoji` 는 레거시 필드(비워 두고, UI 는 PNG 를 사용) */
export type SpecialMissionChipDef = {
  id: string
  title: string
  emoji: string
  /** 자녀 팝업에 넣을 기본 한 줄 (없으면 제목만 씀) */
  defaultPopupMessage: string
}

/** 스페셜 미션 시트에서 보여줄 카테고리 순서 */
export type SpecialMissionChipCategoryDef = {
  id: string
  label: string
  chipIds: string[]
}

/** 부모가 고를 수 있는 스페셜 키워드 목록 (제목은 카드·칩에 짧게 표시) */
export const SPECIAL_MISSION_CHIPS: SpecialMissionChipDef[] = [
  {
    id: 'sp-meal',
    /** 카드·칩에 보이는 짧은 이름 — 공백은 「준비」와 「돕기」만 구분 (PNG 매핑 키와 동일) */
    title: '식사준비 돕기',
    emoji: '',
    defaultPopupMessage: '식사 준비를 함께 도와주어요.',
  },
  {
    id: 'sp-greet',
    title: '인사잘하기',
    emoji: '',
    defaultPopupMessage: '오늘은 밝게 인사해 보아요!',
  },
  {
    id: 'sp-pray',
    /** 일상에서 제거 후 스페셜 전용 — 옛 제목 「기도」는 레거시 매핑으로 같은 칩과 연결됩니다 */
    title: '기도하기',
    emoji: '',
    defaultPopupMessage: '오늘 하루를 작게 기도해 보아요.',
  },
  {
    id: 'sp-massage',
    title: '어깨마사지',
    emoji: '',
    defaultPopupMessage: '부모님 어깨를 살살 주물러 드려요.',
  },
  {
    id: 'sp-recycle',
    title: '분리수거',
    emoji: '',
    defaultPopupMessage: '분리수거를 정확히 해보아요.',
  },
  {
    id: 'sp-exercise',
    title: '운동하기',
    emoji: '',
    defaultPopupMessage: '오늘은 몸을 조금 움직여 보아요!',
  },
  {
    id: 'sp-water-plant',
    title: '화분 물주기',
    emoji: '',
    defaultPopupMessage: '화분 흙 상태를 보고 알맞게 물을 주세요.',
  },
  {
    id: 'sp-saving',
    title: '저축하기',
    emoji: '',
    defaultPopupMessage: '오늘 쓴 돈을 확인하고 조금씩 저축해 보아요.',
  },
  {
    id: 'sp-fold-laundry',
    title: '빨래개기',
    emoji: '',
    defaultPopupMessage: '빨래한 옷을 가지런히 개어 정리해요.',
  },
  {
    id: 'sp-meditation',
    title: '명상하기',
    emoji: '',
    defaultPopupMessage: '잠깐 눈을 감고 천천히 숨을 쉬어 보아요.',
  },
  {
    id: 'sp-homework',
    title: '숙제·공부하기',
    emoji: '',
    defaultPopupMessage: '숙제와 공부를 스스로 끝내 보아요.',
  },
  {
    id: 'sp-veggies',
    title: '야채먹기',
    emoji: '',
    defaultPopupMessage: '야채를 맛있게 먹어 보아요.',
  },
  {
    id: 'sp-finish-meal',
    title: '밥 다 먹기',
    emoji: '',
    defaultPopupMessage: '오늘도 반찬을 골고루 먹어 보아요!',
  },
  {
    id: 'sp-after-meal-clear',
    title: '식사 후 정리하기',
    emoji: '',
    defaultPopupMessage: '식사가 끝나면 그릇과 식탁을 정리해요.',
  },
  {
    id: 'sp-laundry-basket',
    title: '빨래통에넣기',
    emoji: '',
    defaultPopupMessage: '입었던 옷을 빨래통에 넣어 두어요.',
  },
  {
    id: 'sp-laundry-neat',
    /** 「외투걸어놓기」와 별개 — 050 에서 잘못 합쳐졌던 항목을 다시 분리 */
    title: '빨래정리',
    emoji: '',
    defaultPopupMessage: '빨래한 옷과 세탁 공간을 가지런히 정리해요.',
  },
  {
    id: 'sp-laundry-tidy',
    title: '외투걸어놓기',
    emoji: '',
    defaultPopupMessage: '다녀온 외투를 옷걸이나 지정한 곳에 걸어 두어요.',
  },
  {
    id: 'sp-nails',
    title: '손톱깎기',
    emoji: '',
    defaultPopupMessage: '손톱을 깔끔하게 다듬어요.',
  },
  {
    id: 'sp-clean-bed',
    title: '이불 정리하기',
    emoji: '',
    defaultPopupMessage: '이불과 베개를 예쁘게 정리해요.',
  },
]

/** 스페셜 미션 시트에서 보여줄 카테고리 순서 */
export const SPECIAL_MISSION_CHIP_CATEGORIES: SpecialMissionChipCategoryDef[] = [
  {
    id: 'household',
    label: '집안일',
    chipIds: [
      'sp-fold-laundry',
      'sp-laundry-basket',
      'sp-laundry-neat',
      'sp-laundry-tidy',
      'sp-clean-bed',
      'sp-meal',
      'sp-finish-meal',
      'sp-after-meal-clear',
      'sp-recycle',
    ],
  },
  {
    id: 'manners',
    label: '예절',
    chipIds: ['sp-greet', 'sp-massage'],
  },
  {
    id: 'health-beauty',
    label: '건강/미용',
    chipIds: ['sp-nails', 'sp-meditation', 'sp-exercise', 'sp-veggies'],
  },
]

/**
 * 예전에 저장된 미션 제목 → 현재 칩 제목(표시·매칭용)
 * DB에 옛 짧은 이름(인사, 어깨)이 남아 있어도 시트·카드에서 새 이름으로 이어집니다.
 */
const LEGACY_SPECIAL_TITLE_TO_SHORT: Record<string, string> = {
  /** 스페셜 칩 표기 통일 */
  기도: '기도하기',
  식사준비: '식사준비 돕기',
  식사준비하기: '식사준비 돕기',
  /** 예전 한 줄 표기 — 칩 제목과 맞춥니다 */
  식사준비돕기: '식사준비 돕기',
  '식사 준비 돕기': '식사준비 돕기',
  '인사 잘하기': '인사잘하기',
  인사: '인사잘하기',
  화분에물주기: '화분 물주기',
  저금하기: '저축하기',
  '옷 개키기': '빨래개기',
  '부모님 어깨 주물러드리기': '어깨마사지',
  어깨: '어깨마사지',
  분리수거하기: '분리수거',
  /** 폐지된 칩 — 매칭만 남기고 아래 RETIRED 에서 숨김 */
  가방정리하기: '가방정리',
  '빨래통에 넣기': '빨래통에넣기',
  '외투 걸어두기': '외투걸어놓기',
  '빨래 정리': '빨래정리',
  '밥 다먹기': '밥 다 먹기',
  밥그릇비우기: '밥 다 먹기',
  '밥그릇 비우기': '밥 다 먹기',
  /** 예전 「식사 후 정리」류는 그릇 정리 칩으로 통합 */
  식사후정리: '식사 후 정리하기',
  '식사후 정리': '식사 후 정리하기',
  '식사 후 정리': '식사 후 정리하기',
  /** 이불 정리 — 옛 표기·공백 차이 */
  이불개기: '이불 정리하기',
  '이불 개기': '이불 정리하기',
  '이불정리하기': '이불 정리하기',
  /** 구버전 — 일상·스페셜 칩 표기 통일 */
  숙제하기: '숙제·공부하기',
}

/** 루틴 탭 스페셜 카드 등에 표시할 짧은 제목 */
export function displaySpecialMissionTitle(storedTitle: string): string {
  const t = storedTitle.trim()
  return LEGACY_SPECIAL_TITLE_TO_SHORT[t] ?? t
}

/**
 * 스페셜 칩에서 **완전히 뺀** 미션 제목 — DB 에 옛 템플릿이 남아 있어도 카드·시트에서 숨깁니다.
 * (마이그레이션 `051_remove_retired_special_mission_templates.sql` 로 행 삭제 권장)
 * `설거지`·`골고루먹기`·`신발신기`/`신발 신기`는 활성 daily로 쓰이므로 숨김 대상에서 제외합니다.
 */
const RETIRED_SPECIAL_DISPLAY_TITLES = new Set<string>([
  '방청소',
  '심부름',
  '심부름하기',
  '방 청소하기',
  /** 과거 시드/레거시 미션: 더 이상 사용하지 않음 */
  '스스로양말신기',
  '양말신기',
  /** 스페셜 「가방정리」 칩 제거 — 구 템플릿만 남은 경우 숨김 */
  '가방정리',
  /** 현재 칩 목록에 없는 옛 스페셜 시드 */
  '어른께인사하기',
  '장난감정리하기',
  '목욕하기',
  '밥먹고 정리하기',
  /** 오전 일상으로 옮김 — 남은 스페셜 템플릿 숨김 */
  '가글하기',
  '머리빗기',
  '머리 빗기',
  '로션바르기',
  '로션 바르기',
  '로션(선크림)바르기',
])

/** 현재 스페셜 칩 제목(정규화 후) — DB 정리·UI 숨김 기준 */
export const SPECIAL_MISSION_CANONICAL_CHIP_TITLES: readonly string[] = SPECIAL_MISSION_CHIPS.map(
  (c) => c.title,
)

/** 칩에 없는 스페셜 템플릿(폐지·시드 잔여) — 부모 UI에서 숨김 */
export function isOrphanSpecialMissionTemplate(
  m: Pick<Mission, 'title' | 'repeat_type' | 'difficulty'>,
): boolean {
  if (!isSpecialSectionMission(m)) return false
  if (isRetiredSpecialMissionTitle(m.title ?? '')) return true
  const chipId = missionTitleToSpecialChipId(m.title ?? '')
  return chipId === null
}

/** 저장된 제목이 폐지된 스페셜 키워드인지 (레거시 별칭을 짧은 제목으로 푼 뒤에도 검사) */
export function isRetiredSpecialMissionTitle(storedTitle: string): boolean {
  const raw = storedTitle.trim()
  const resolved = displaySpecialMissionTitle(raw).trim()
  return RETIRED_SPECIAL_DISPLAY_TITLES.has(raw) || RETIRED_SPECIAL_DISPLAY_TITLES.has(resolved)
}

/**
 * 스페셜 UI·자녀 앱 스페셜 구역 미션 여부.
 * - 이벤트형(`repeat_type: event`) 또는 난이도 `special`(매일·주간 스페셜 모두 포함).
 * 예전에는 주간(`weekly`) + `special` 만 두 면 일상으로 잘못 분류되던 경우가 있어 `difficulty` 로 통일합니다.
 */
export function isSpecialSectionMission(
  m: Pick<Mission, 'repeat_type' | 'difficulty'> & { title?: string | null },
): boolean {
  /**
   * 레거시 데이터 보정:
   * - 과거에 생성된 「기도/기도하기」가 `difficulty: easy`로 남아 있어도
   *   현재 정책(스페셜 전용)대로 스페셜 구역으로 보이게 강제합니다.
   */
  const rawTitle = (m.title ?? '').trim()
  if (rawTitle) {
    const normalizedTitle = displaySpecialMissionTitle(rawTitle)
    if (normalizedTitle === '기도하기') return true
  }
  if (m.repeat_type === 'event') return true
  return m.difficulty === 'special'
}

/** 일상 미션(주중·주말 블록) 템플릿 여부 — 이벤트·special 난이도 제외 */
export function isRoutineSectionMission(
  m: Pick<Mission, 'repeat_type' | 'difficulty'> & { title?: string | null },
): boolean {
  return !isSpecialSectionMission(m)
}

/** 스페셜 시트용 — DB에 저장된 제목(레거시 긴 이름 포함)을 칩 id 로 바꿉니다. 없으면 null */
export function missionTitleToSpecialChipId(storedTitle: string): string | null {
  const short = displaySpecialMissionTitle(storedTitle)
  return SPECIAL_MISSION_CHIPS.find((c) => c.title === short)?.id ?? null
}

/** 같은 스페셜 키워드(칩)끼리 묶을 때 쓰는 키 — 칩 정의가 없으면 정규화 제목으로 구분 */
export function specialMissionChipKey(m: Pick<Mission, 'title'>): string {
  const chipId = missionTitleToSpecialChipId(m.title)
  return chipId ?? `__custom__:${displaySpecialMissionTitle(m.title)}`
}

/**
 * 같은 칩에 daily·event 템플릿이 둘 다 있을 때 어느 행을 대표로 쓸지 고릅니다.
 * 매일(daily) > 오늘만(event), 활성 > 비활성 순으로 우선합니다.
 */
export function pickPreferredSpecialMissionDuplicate(a: Mission, b: Mission): Mission {
  const score = (x: Mission) => {
    let s = 0
    if (x.repeat_type === 'daily') s += 4
    if (x.is_active) s += 2
    return s
  }
  const sa = score(a)
  const sb = score(b)
  return sa >= sb ? a : b
}

/**
 * 부모 루틴·스페셜 시트 — 같은 칩(또는 같은 정규화 제목)당 템플릿 행 하나만 남깁니다.
 * 정렬된 목록 순서는 유지하고, 남는 행은 `pickPreferredSpecialMissionDuplicate` 기준입니다.
 */
export function dedupeSpecialLinkedMissionsByChipId(missions: Mission[]): Mission[] {
  const winnerByKey = new Map<string, Mission>()
  for (const m of missions) {
    const key = specialMissionChipKey(m)
    const prev = winnerByKey.get(key)
    winnerByKey.set(key, prev ? pickPreferredSpecialMissionDuplicate(prev, m) : m)
  }
  const winnerIds = new Set([...winnerByKey.values()].map((row) => row.id))
  return missions.filter((m) => winnerIds.has(m.id))
}

/**
 * 스페셜 추가 시트를 열 때 — 이 자녀의 스페셜 템플릿을 칩 선택·데일리 체크·저장 시 비교용 베이스라인으로 씁니다.
 * 같은 칩에 행이 여러 개면 대표 행 하나만 쓰고, 나머지 id 는 저장 시 삭제합니다.
 */
export type SpecialMissionSheetBaseline = Record<
  string,
  { missionId: string; wasDaily: boolean; duplicateMissionIds?: string[] }
>

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
  const rowsByChipId = new Map<string, Mission[]>()
  for (const m of list) {
    const chipId = missionTitleToSpecialChipId(m.title)
    if (!chipId) continue
    const bucket = rowsByChipId.get(chipId)
    if (bucket) bucket.push(m)
    else rowsByChipId.set(chipId, [m])
  }

  const baseline: SpecialMissionSheetBaseline = {}
  for (const [chipId, rows] of rowsByChipId) {
    const winner = rows.reduce(pickPreferredSpecialMissionDuplicate)
    const duplicateMissionIds = rows.filter((row) => row.id !== winner.id).map((row) => row.id)
    baseline[chipId] = {
      missionId: winner.id,
      /** repeat_type daily 이면 매일 구역 — 레거시 기도하기(daily+easy)도 포함 */
      wasDaily: winner.repeat_type === 'daily',
      ...(duplicateMissionIds.length > 0 ? { duplicateMissionIds } : {}),
    }
  }

  const selectedIds = Object.keys(baseline)
  const dailyAutoIds = selectedIds.filter((id) => baseline[id].wasDaily)
  return { selectedIds, dailyAutoIds, baseline }
}
