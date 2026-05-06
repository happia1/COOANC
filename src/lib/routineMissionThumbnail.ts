/**
 * 루틴·일상 미션 카드 썸네일
 * - DB `icon_emoji` 에 잘못된 PNG 경로가 들어가도, **알려진 제목**이면 제목 기준 이미지를 우선합니다.
 * - 전용 PNG 가 없는 제목(예: 저녁식사 → 아틀라스 `dinner` 프레임)은 `null` 을 돌려 호출 쪽에서 스프라이트를 씁니다.
 */

import { displaySpecialMissionTitle } from '@/lib/specialMissionChips'
import { canonicalRoutineChipMatchTitle } from '@/lib/routineMissionTitleCanon'

const BASE = '/assets/img/missions/routine'

/** 샤워·씻기 루틴 공통 — `목욕/샤워` 옛 제목은 별칭으로 여기와 같은 파일을 씁니다 */
const SHOWER_ROUTINE_PNG = `${BASE}/p.m/shower.png`

/** 「식사 준비 돕기」계열 전용 PNG — 제목 표기가 조금 달라도 같은 파일을 씁니다. */
const MEAL_PREP_HELP_ROUTINE_PNG = `${BASE}/special/put_cutrary.png`

/** 스페셜 칩 「밥 다 먹기」·레거시 `밥그릇비우기`(같은 칩으로 통합) 일러스트 */
const FINISH_MEAL_ROUTINE_PNG = `${BASE}/special/clean_up_all.png`

/** 일상 칩 「야외놀이」— 파일명은 오타처럼 보여도(`paly`) 번들 자산 이름입니다 */
const OUTDOOR_PLAY_ROUTINE_PNG = `${BASE}/p.m/paly_outside.png`

/** 일상 칩 「실내놀이」 */
const INDOOR_PLAY_ROUTINE_PNG = `${BASE}/p.m/play_inside.png`

/** DB 칼럼에 넣은 값이 루틴 전용 PNG 경로인지 여부 */
export function isRoutineImagePath(icon: string | null | undefined): boolean {
  if (!icon) return false
  return icon.startsWith('/assets/img/missions/routine/')
}

/**
 * 아틀라스(`missionRoutineIconFrame`)만 쓰고, DB PNG 는 무시할 제목.
 * (예: 저녁식사 — 전용 dinner PNG 가 없고, 예전 시드가 책 그림으로 잘못 연결된 경우)
 */
const ATLAS_ONLY_TITLES = new Set<string>(['저녁식사'])

/**
 * 미션 제목(및 스페셜 레거시 제목 정규화) → 공개 폴더의 PNG 경로.
 * 키는 `trim` 된 문자열이며, 키워드 칩·046 시드·자주 쓰는 별칭을 모두 넣습니다.
 * (실제 파일은 `public/assets/img/missions/routine/...` 에 있어야 합니다.)
 */
const PNG_BY_TITLE: Record<string, string> = {
  // --- 오전 / 등교 ---
  일어나기: `${BASE}/a.m/morning.png`,
  기상: `${BASE}/a.m/morning.png`,
  양치하기: `${BASE}/a.m/brush_teeth.png`,
  양치: `${BASE}/a.m/brush_teeth.png`,
  아침식사: `${BASE}/a.m/breakfase.png`,
  /** 오전 물마시기 */
  물마시기: `${BASE}/a.m/water.png`,
  화장실: `${BASE}/a.m/toilet.png`,
  마스크: `${BASE}/a.m/mask.png`,
  옷갈아입기: `${BASE}/a.m/change.png`,
  '옷 갈아입기': `${BASE}/a.m/change.png`,
  버스타기: `${BASE}/a.m/bus.png`,
  '등원/등교하기': `${BASE}/a.m/bus.png`,
  등원하기: `${BASE}/a.m/bus.png`,
  세수하기: `${BASE}/a.m/wash_face.png`,
  세수: `${BASE}/a.m/wash_face.png`,

  // --- 오후·저녁·취침 전 (한 줄 UI 에 함께 표시) ---
  야외놀이: OUTDOOR_PLAY_ROUTINE_PNG,
  /** 제목에 공백이 들어간 구버전·사용자 입력 */
  '야외 놀이': OUTDOOR_PLAY_ROUTINE_PNG,
  /** 실외는 「바깥·야외」와 같은 뜻으로 옛 표기·수동 입력에 쓰이기도 함 → 같은 일러스트 */
  실외놀이: OUTDOOR_PLAY_ROUTINE_PNG,
  '실외 놀이': OUTDOOR_PLAY_ROUTINE_PNG,
  바깥놀이: OUTDOOR_PLAY_ROUTINE_PNG,
  '바깥 놀이': OUTDOOR_PLAY_ROUTINE_PNG,
  손씻기: `${BASE}/p.m/wash_hand.png`,
  실내놀이: INDOOR_PLAY_ROUTINE_PNG,
  '실내 놀이': INDOOR_PLAY_ROUTINE_PNG,
  /** 저녁 물마시기 — 오전 「물마시기」와 다른 파일 */
  저녁물마시기: `${BASE}/p.m/water.png`,
  '저녁 물마시기': `${BASE}/p.m/water.png`,
  /** 예전 표기 */
  '물마시기(저녁)': `${BASE}/p.m/water.png`,
  기도: `${BASE}/p.m/pray.png`,
  장난감정리: `${BASE}/p.m/organize_toys.png`,
  잠옷갈아입기: `${BASE}/p.m/pajama.png`,
  '빨래통에 옷넣기': `${BASE}/p.m/roundrybasket.png`,
  /** 잠자리 독서 — `book.png` */
  '잠자리 독서': `${BASE}/p.m/book.png`,
  잠자리독서: `${BASE}/p.m/book.png`,
  독서활동: `${BASE}/p.m/book.png`,
  잠자기: `${BASE}/p.m/night.png`,
  '잘 시간': `${BASE}/p.m/night.png`,
  취침: `${BASE}/p.m/night.png`,
  씻기: SHOWER_ROUTINE_PNG,
  /** 일상 칩 「샤워하기」— 전용 PNG */
  샤워하기: SHOWER_ROUTINE_PNG,
  '모두 제자리': `${BASE}/p.m/organize_toys.png`,
  '잠자리 양치': `${BASE}/a.m/brush_teeth.png`,
  '잠옷 갈아입기': `${BASE}/p.m/pajama.png`,
  숙제하기: `${BASE}/special/diary_homework.png`,

  // --- 스페셜 시드(046 긴 이름) ---
  스스로옷입기: `${BASE}/special/self_change.png`,
  스스로양말신기: `${BASE}/special/self_socks.png`,
  화분에물주기: `${BASE}/special/water_plant.png`,
  '화분 물주기': `${BASE}/special/water_plant.png`,
  식사준비하기: MEAL_PREP_HELP_ROUTINE_PNG,
  식사준비돕기: MEAL_PREP_HELP_ROUTINE_PNG,
  '식사준비 돕기': MEAL_PREP_HELP_ROUTINE_PNG,
  '식사 준비 돕기': MEAL_PREP_HELP_ROUTINE_PNG,
  /** 예전 이름 — UI·레거시 매핑상 「밥 다 먹기」 칩과 동일하게 취급 */
  밥그릇비우기: FINISH_MEAL_ROUTINE_PNG,
  '밥그릇 비우기': FINISH_MEAL_ROUTINE_PNG,
  야채먹기: `${BASE}/special/eat_vegitables.png`,
  밥먹고정리하기: FINISH_MEAL_ROUTINE_PNG,
  '밥먹고 정리하기': FINISH_MEAL_ROUTINE_PNG,
  분리수거하기: `${BASE}/special/sort_recycle.png`,
  장난감정리하기: `${BASE}/special/organize_toys.png`,
  '옷 개키기': `${BASE}/special/organize_cloth.png`,
  빨래개기: `${BASE}/special/organize_cloth.png`,
  명상하기: `${BASE}/special/meditation.png`,
  저금하기: `${BASE}/special/saving.png`,
  저축하기: `${BASE}/special/saving.png`,
  손톱깎기: `${BASE}/special/nail_cliper.png`,
  인사잘하기: `${BASE}/special/say_hello.png`,
  어른께인사하기: `${BASE}/special/bow_to_adult.png`,
  목욕하기: `${BASE}/special/bath.png`,

  // --- 스페셜 키워드 칩(짧은 제목) — `displaySpecialMissionTitle` 후에도 매칭되도록 ---
  식사준비: MEAL_PREP_HELP_ROUTINE_PNG,
  빨래통에넣기: `${BASE}/p.m/roundrybasket.png`,
  외투걸어놓기: `${BASE}/special/hanging_cloth.png`,
  어깨마사지: `${BASE}/special/parent_massage.png`,
  분리수거: `${BASE}/special/sort_recycle.png`,
  운동하기: `${BASE}/special/yoga.png`,
  /** 스페셜 칩 「식사 후 정리하기」— 그릇·식탁 정리 */
  '식사 후 정리하기': `${BASE}/special/put_away_dishes.png`,
  /** 레거시 DB 제목(050 등) — 칩 표시명과 통일되면 `displaySpecialMissionTitle` 로 매칭됨 */
  식사후정리: `${BASE}/special/put_away_dishes.png`,
  '식사후 정리': `${BASE}/special/put_away_dishes.png`,
  '식사 후 정리': `${BASE}/special/put_away_dishes.png`,
  /** 스페셜 칩 「밥 다 먹기」— 골고루 먹기·식사 마무리 장면 */
  '밥 다 먹기': FINISH_MEAL_ROUTINE_PNG,
  '밥 다먹기': FINISH_MEAL_ROUTINE_PNG,
  '빨래통에 넣기': `${BASE}/p.m/roundrybasket.png`,
  외투걸어두기: `${BASE}/special/hanging_cloth.png`,
  '외투 걸어두기': `${BASE}/special/hanging_cloth.png`,
}

/**
 * 미션 제목을 PNG 매칭용으로만 살짝 정리합니다.
 * - NFC 로 한글 조합 형태를 통일하고, 복사·붙여넣기로 들어온 “보이지 않는 문자”를 제거합니다.
 */
function normalizeTitleForPngLookup(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
}

/**
 * 모든 공백을 없앤 뒤 본문만 보고 「식사 준비 돕기」류인지 판별합니다.
 * (예: DB에 `식사준비돕기`, `식사 준 비 돕기`, `식사준비 돕기` 등이 섞여 있어도 같은 그림)
 */
function compactTitleNoSpaces(title: string): string {
  return normalizeTitleForPngLookup(title).replace(/\s+/gu, '')
}

function isMealPrepHelpMissionCompact(compact: string): boolean {
  return /^식사준비(돕기|하기)?$/.test(compact)
}

/** 「밥 다 먹기」— 공백만 다른 표기도 `밥다먹기` 한 덩어리로 본다 */
function isFinishMealMissionCompact(compact: string): boolean {
  return compact === '밥다먹기'
}

/** 야외·실외·바깥 + 놀이 가 한 덩어리일 때 — 표에 없는 살짝 다른 표기도 바깥 놀이 그림으로 맞춤 */
function isOutdoorPlayMissionCompact(compact: string): boolean {
  return /^(야외놀이|실외놀이|바깥놀이)$/.test(compact)
}

/** 실내 + 놀이 — 아틀라스 기본(`play_inside`) 대신 전용 PNG 고정 */
function isIndoorPlayMissionCompact(compact: string): boolean {
  return compact === '실내놀이'
}

/**
 * DB 에 「야외에서 놀이」처럼 긴 문장만 적혀 있으면 표·단축 정규식에 안 걸려 스프라이트로 빠집니다.
 * 공백을 없앤 문자열에 야외·실외·바깥·밖 + 놀이 가 함께 있으면 바깥 놀이 PNG 로 고릅니다.
 */
function isOutdoorPlayTitleHeuristic(compact: string): boolean {
  if (isOutdoorPlayMissionCompact(compact)) return true
  if (
    compact.includes('야외놀이') ||
    compact.includes('실외놀이') ||
    compact.includes('바깥놀이')
  ) {
    return true
  }
  const outdoorCue = /야외|실외|바깥|밖에서/.test(compact)
  return outdoorCue && compact.includes('놀이')
}

/** 실내 + 놀이 문장형 — 실외·야외 단서가 없을 때만 실내 놀이 PNG */
function isIndoorPlayTitleHeuristic(compact: string): boolean {
  if (isIndoorPlayMissionCompact(compact)) return true
  if (compact.includes('실내놀이')) return true
  if (/야외|실외|바깥|밖에서/.test(compact)) return false
  return compact.includes('실내') && compact.includes('놀이')
}

/** 같은 블록에 「물마시기」→「저녁 물마시기」처럼 칩 제목으로 바꾼 뒤 PNG 표를 먼저 탐색합니다 */
function titlesForRoutinePngLookup(title: string, block?: string | null): string[] {
  const raw = normalizeTitleForPngLookup(title)
  const canon = normalizeTitleForPngLookup(
    canonicalRoutineChipMatchTitle({ title: raw, block: block ?? null }),
  )
  return canon === raw ? [raw] : [canon, raw]
}

function uniqueLookupKeys(title: string): string[] {
  const raw = normalizeTitleForPngLookup(title)
  const normalized = raw.replace(/\s+/g, ' ')
  /** 칩 표시명으로 바꾼 제목을 **가장 먼저** 씁니다 — 옛 DB 제목이 남아도 칩 그림과 맞춤(예: 밥그릇비우기→밥 다 먹기). */
  const special = displaySpecialMissionTitle(raw)
  const compact = compactTitleNoSpaces(raw)
  /** 표 매칭이 한 번에 안 될 때를 대비해 짧은 동의어 키도 넣습니다 */
  const mealPrepHints = isMealPrepHelpMissionCompact(compact)
    ? (['식사준비돕기', '식사준비 돕기'] as const)
    : ([] as const)
  const finishMealHints = isFinishMealMissionCompact(compact)
    ? (['밥 다 먹기', '밥 다먹기'] as const)
    : ([] as const)
  const outdoorHints = isOutdoorPlayMissionCompact(compact)
    ? (['야외놀이', '야외 놀이'] as const)
    : ([] as const)
  const indoorHints = isIndoorPlayMissionCompact(compact)
    ? (['실내놀이', '실내 놀이'] as const)
    : ([] as const)
  return Array.from(
    new Set([
      special,
      raw,
      normalized,
      ...mealPrepHints,
      ...finishMealHints,
      ...outdoorHints,
      ...indoorHints,
    ].filter(Boolean)),
  )
}

/**
 * 카드에 넣을 루틴 PNG URL — 없으면 `null` 이면 아틀라스(`missionRoutineIconFrame`)를 쓰면 됩니다.
 * - 알려진 제목 → 항상 표에 맞는 PNG (또는 아틀라스 전용 제목이면 `null`).
 * - 비어 있거나 매칭 실패 → DB 가 루틴 PNG 경로면 그대로 사용(부모가 만든 커스텀 제목 대비).
 */
export function resolveRoutineMissionPngUrl(params: {
  title: string
  iconEmoji?: string | null
  /** daily_missions 조인 시 템플릿 블록 — 「물마시기」등 블록별 칩 이름 구분에 씁니다 */
  block?: string | null
}): string | null {
  for (const seqTitle of titlesForRoutinePngLookup(params.title, params.block)) {
    for (const key of uniqueLookupKeys(seqTitle)) {
      if (ATLAS_ONLY_TITLES.has(key)) return null
      const mapped = PNG_BY_TITLE[key]
      if (mapped) return mapped
    }
  }

  /** 표에 없는 표기라도 공백만 다른 경우 → 수저·식사 준비 일러스트로 고정 */
  if (isMealPrepHelpMissionCompact(compactTitleNoSpaces(params.title))) {
    return MEAL_PREP_HELP_ROUTINE_PNG
  }

  /** 「밥 다 먹기」류 — 아틀라스 `eat_well` 로 새지 않게 동일 파일로 고정 */
  if (isFinishMealMissionCompact(compactTitleNoSpaces(params.title))) {
    return FINISH_MEAL_ROUTINE_PNG
  }

  const compactPlay = compactTitleNoSpaces(params.title)
  if (isOutdoorPlayTitleHeuristic(compactPlay)) {
    return OUTDOOR_PLAY_ROUTINE_PNG
  }
  if (isIndoorPlayTitleHeuristic(compactPlay)) {
    return INDOOR_PLAY_ROUTINE_PNG
  }

  const icon = params.iconEmoji?.trim()
  if (icon && isRoutineImagePath(icon)) return icon
  return null
}

/**
 * 새 미션 생성 시 DB `icon_emoji` 에 넣을 값 — 스페셜·루틴 공통으로 **PNG 경로**를 우선 저장합니다.
 * 이미지가 없으면 플레이스홀더 `·` 를 씁니다.
 */
export function routineMissionIconEmojiForCreate(title: string): string {
  return resolveRoutineMissionPngUrl({ title, iconEmoji: null }) ?? '·'
}
