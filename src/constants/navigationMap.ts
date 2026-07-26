/**
 * 항해지도 섹션 정의
 * 각 섹션은 minLevel 조건을 만족해야 잠금 해제됩니다.
 * 섹션마다 STEPS_PER_SECTION개의 칸이 있으며, 하루 90% 미션 달성 시 배가 1칸 전진합니다.
 */
export const NAV_MAP_SECTIONS = [
  {
    index: 0,
    name: '연안(기초)',
    subtitle: '돈 개념 · 저축 개념',
    color: '#e8f5e9',
    accentColor: '#4caf50',
    emoji: '🏖️',
    minLevel: 0,
    minAge: null as number | null,
  },
  {
    index: 1,
    name: '근해',
    subtitle: '소비 vs 저축',
    color: '#e3f2fd',
    accentColor: '#2196f3',
    emoji: '⚓',
    minLevel: 1,
    minAge: null as number | null,
  },
  {
    index: 2,
    name: '외해',
    subtitle: '투자 개념',
    color: '#e8eaf6',
    accentColor: '#3f51b5',
    emoji: '🌊',
    minLevel: 3,
    minAge: null as number | null,
  },
  {
    index: 3,
    name: '심해',
    subtitle: '리스크 / 복리 개념',
    color: '#e0f7fa',
    accentColor: '#006064',
    emoji: '🐋',
    minLevel: 5,
    minAge: null as number | null,
  },
] as const

export type NavMapSection = (typeof NAV_MAP_SECTIONS)[number]

/** 섹션당 배 이동 칸 수 */
export const STEPS_PER_SECTION = 5

/**
 * 항해지도가 자녀 앱에 열리는 최소 레벨.
 *
 * 지금은 캐릭터를 눌러야 나오는 팝업 안에 있고 아직 준비 중인 기능이라,
 * 초반 레벨에서 안내하지 않고 후반(레벨 15)에 열리는 것으로 잡아 두었습니다.
 * 세계관(정원·마을·항구·바다)을 다시 설계할 때 이 값과 위 섹션 minLevel 을 함께 맞춰 주세요.
 */
export const NAV_MAP_UNLOCK_MIN_LEVEL = 15
