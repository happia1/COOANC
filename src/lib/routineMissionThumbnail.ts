/**
 * 루틴·일상 미션 카드 썸네일
 * - DB `icon_emoji` 에 잘못된 PNG 경로가 들어가도, **알려진 제목**이면 제목 기준 이미지를 우선합니다.
 * - 전용 PNG 가 없는 제목(예: 저녁식사 → 아틀라스 `dinner` 프레임)은 `null` 을 돌려 호출 쪽에서 스프라이트를 씁니다.
 */

import { displaySpecialMissionTitle } from '@/lib/specialMissionChips'

const BASE = '/assets/img/missions/routine'

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
 */
const PNG_BY_TITLE: Record<string, string> = {
  // --- 오전 / 등교 (046 + 키워드 칩) ---
  일어나기: `${BASE}/a.m/wake_up.png`,
  기상: `${BASE}/a.m/wake_up.png`,
  양치하기: `${BASE}/a.m/brush_teeth.png`,
  양치: `${BASE}/a.m/brush_teeth.png`,
  아침식사: `${BASE}/a.m/breakfase.png`,
  물마시기: `${BASE}/a.m/dringking.png`,
  옷갈아입기: `${BASE}/a.m/change.png`,
  '옷 갈아입기': `${BASE}/a.m/change.png`,
  버스타기: `${BASE}/a.m/school_bus.png`,
  '등원/등교하기': `${BASE}/a.m/school_bus.png`,
  등원하기: `${BASE}/a.m/school_bus.png`,
  // 아침 세수 — 얼굴 씻기 이미지(a.m/wash_face.png)로 고정
  세수하기: `${BASE}/a.m/wash_face.png`,
  세수: `${BASE}/a.m/wash_face.png`,

  // --- 오후·저녁·취침 전 (046) ---
  야외놀이: `${BASE}/p.m/paly_outside.png`,
  손씻기: `${BASE}/p.m/wash_hand.png`,
  가방정리: `${BASE}/p.m/bag_packing.png`,
  실내놀이: `${BASE}/p.m/play_inside.png`,
  '물마시기(저녁)': `${BASE}/a.m/dringking.png`,
  장난감정리: `${BASE}/p.m/organize_toys.png`,
  씻기: `${BASE}/p.m/shower.png`,
  잠옷갈아입기: `${BASE}/p.m/pajama.png`,
  '빨래통에 옷넣기': `${BASE}/p.m/roundrybasket.png`,
  /**
   * 잠자리 독서 이미지는 현재 파일명(`read_book.png`) 기준으로 고정합니다.
   * (기존 `book.png`/`p.m/book.png` 혼용으로 카드별 이미지가 다르게 보이던 문제 정리)
   */
  '잠자리 독서': `${BASE}/p.m/read_book.png`,
  잠자리독서: `${BASE}/p.m/read_book.png`,
  /**
   * 취침/잠자기 계열은 현재 파일(`go_to_bed.png`)로 통일합니다.
   * (구 파일명 `goodnight.png` 는 현재 리포지토리에 없음)
   */
  잠자기: `${BASE}/p.m/go_to_bed.png`,
  /** 제목 변경: 구 「취침」·신 「잘 시간」 같은 썸네일 */
  '잘 시간': `${BASE}/p.m/go_to_bed.png`,

  // --- 키워드 칩 (046 제목과 다른 이름) ---
  '가방 챙기기': `${BASE}/p.m/bag_packing.png`,
  독서활동: `${BASE}/p.m/read_book.png`,
  '모두 제자리': `${BASE}/p.m/organize_toys.png`,
  '목욕/샤워': `${BASE}/p.m/shower.png`,
  '잠자리 양치': `${BASE}/a.m/brush_teeth.png`,
  '잠옷 갈아입기': `${BASE}/p.m/pajama.png`,
  취침: `${BASE}/p.m/go_to_bed.png`,

  // --- 스페셜 시드(046 긴 이름) ---
  스스로옷입기: `${BASE}/special/self_change.png`,
  스스로양말신기: `${BASE}/special/self_socks.png`,
  화분에물주기: `${BASE}/special/water_plant.png`,
  '화분 물주기': `${BASE}/special/water_plant.png`,
  식사준비하기: `${BASE}/special/put_cutrary.png`,
  식사준비돕기: `${BASE}/special/put_cutrary.png`,
  밥그릇비우기: `${BASE}/special/put_away_dishes.png`,
  '밥그릇 비우기': `${BASE}/special/put_away_dishes.png`,
  야채먹기: `${BASE}/special/eat_vegitables.png`,
  밥먹고정리하기: `${BASE}/special/clean_up_all.png`,
  '밥먹고 정리하기': `${BASE}/special/clean_up_all.png`,
  분리수거하기: `${BASE}/special/sort_recycle.png`,
  장난감정리하기: `${BASE}/special/organize_toys.png`,
  '옷 개키기': `${BASE}/special/organize_cloth.png`,
  빨래개기: `${BASE}/special/organize_cloth.png`,
  명상하기: `${BASE}/special/meditation.png`,
  /**
   * 숙제 일러스트는 현재 실파일(`diary_homework.png`)로 매칭합니다.
   * (기존 `homework.png` 는 현재 리포지토리에 없음)
   */
  숙제하기: `${BASE}/special/diary_homework.png`,
  저금하기: `${BASE}/special/saving.png`,
  저축하기: `${BASE}/special/saving.png`,
  손톱깎기: `${BASE}/special/nail_cliper.png`,
  인사잘하기: `${BASE}/special/say_hello.png`,
  어른께인사하기: `${BASE}/special/bow_to_adult.png`,
  목욕하기: `${BASE}/special/bath.png`,

  // --- 스페셜 키워드 칩(짧은 제목) — `displaySpecialMissionTitle` 후에도 매칭되도록 ---
  식사준비: `${BASE}/special/put_cutrary.png`,
  빨래통에넣기: `${BASE}/p.m/roundrybasket.png`,
  외투걸어놓기: `${BASE}/special/hanging_cloth.png`,
  어깨마사지: `${BASE}/special/parent_massage.png`,
  분리수거: `${BASE}/special/sort_recycle.png`,
  운동하기: `${BASE}/special/yoga.png`,
  /** 레거시 스페셜 칩 「식사후 정리」 별칭 유지 */
  식사후정리: `${BASE}/special/clean_up_all.png`,
  '식사후 정리': `${BASE}/special/clean_up_all.png`,
  /** 요청 반영: 띄어쓰기 형태(식사 후 정리)도 동일 이미지로 매칭 */
  '식사 후 정리': `${BASE}/special/clean_up_all.png`,
  /** 새 표기명 */
  '밥 다 먹기': `${BASE}/special/clean_up_all.png`,
  '밥 다먹기': `${BASE}/special/clean_up_all.png`,
  '빨래통에 넣기': `${BASE}/p.m/roundrybasket.png`,
  /** 옷걸이에 외투 걸기 — `hanging_cloth` 일러스트 사용 */
  외투걸어두기: `${BASE}/special/hanging_cloth.png`,
  '외투 걸어두기': `${BASE}/special/hanging_cloth.png`,
  가방정리하기: `${BASE}/p.m/bag_packing.png`,
}

function uniqueLookupKeys(title: string): string[] {
  const raw = title.trim()
  const normalized = raw.replace(/\s+/g, ' ')
  const special = displaySpecialMissionTitle(raw)
  return Array.from(new Set([raw, normalized, special].filter(Boolean)))
}

/**
 * 카드에 넣을 루틴 PNG URL — 없으면 `null` 이면 아틀라스(`missionRoutineIconFrame`)를 쓰면 됩니다.
 * - 알려진 제목 → 항상 표에 맞는 PNG (또는 아틀라스 전용 제목이면 `null`).
 * - 비어 있거나 매칭 실패 → DB 가 루틴 PNG 경로면 그대로 사용(부모가 만든 커스텀 제목 대비).
 */
export function resolveRoutineMissionPngUrl(params: {
  title: string
  iconEmoji?: string | null
}): string | null {
  for (const key of uniqueLookupKeys(params.title)) {
    if (ATLAS_ONLY_TITLES.has(key)) return null
    const mapped = PNG_BY_TITLE[key]
    if (mapped) return mapped
  }

  const icon = params.iconEmoji?.trim()
  if (icon && isRoutineImagePath(icon)) return icon
  return null
}
