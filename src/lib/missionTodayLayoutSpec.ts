import type { CSSProperties } from 'react'

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 오늘의 미션(미션 탭 하단) 레이아웃 스펙 — 확정값
 *
 * - 세로 분할(상단 풍경 vs 하단 카드 영역), 하단 패널 여백·겹침, 카드 안의
 *   이미지 영역·제목·부제·크레딧(EXP) 알약의 비율·간격이 여기에 모여 있습니다.
 * - 기획·디자인 합의 없이 이 파일의 클래스·숫자를 바꾸지 마세요.
 * - `MissionTab` 은 이 모듈에서 가져온 값만 쓰도록 유지하세요(임의 Tailwind 추가 지양).
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * 예전 미션 탭: 상·하를 flex 비율로만 나누던 값(참고·복구용).
 * 현재 `MissionTab` 은 세로 스크롤 레이아웃이라 아래 헬퍼는 사용하지 않습니다.
 */
export const MISSION_TAB_VERTICAL_SPLIT = {
  upperFlexGrow: 5.5,
  lowerFlexGrow: 4.5,
} as const

/** @deprecated MissionTab 스크롤 전환 이후 미사용 — `flexFill`+하단 패널 분할 복구 시만 */
export const MISSION_TAB_SCENERY_FLEX_WEIGHT: 5.5 = MISSION_TAB_VERTICAL_SPLIT.upperFlexGrow

/** @deprecated MissionTab 스크롤 전환 이후 미사용 */
export function missionTabLowerPanelFlexStyle(): CSSProperties {
  return {
    flexGrow: MISSION_TAB_VERTICAL_SPLIT.lowerFlexGrow,
    flexShrink: 1,
    flexBasis: '0%',
    minHeight: 0,
  }
}

/**
 * 「오늘의 미션」 카드들을 담는 하단 섹션 — 겹침·안쪽 여백 고정.
 * 세로 스크롤은 미션 탭 루트(`MissionTab` 의 `overflow-y-auto`)에서만 처리합니다.
 */
/** 가로는 부모와 탭 전체가 스크롤되지 않게 막고, 카드 행만 내부에서 가로 스크롤 */
export const MISSION_TODAY_BOTTOM_SECTION_CLASSNAME =
  'relative z-10 -mt-12 flex min-w-0 shrink-0 flex-col gap-0.5 overflow-x-hidden overflow-y-visible px-2 pb-2.5 pt-0.5 sm:-mt-12' as const

/** 제목·EXP 막대 한 줄 바깥 래퍼 */
export const MISSION_TODAY_TITLE_ROW_OUTER_CLASSNAME =
  'w-full min-w-0 shrink-0 px-2 pb-0.5 pt-0.5' as const

/** 제목·EXP 를 한 행에 넣는 flex 컨테이너 */
export const MISSION_TODAY_TITLE_ROW_INNER_CLASSNAME =
  'flex w-full min-w-0 flex-nowrap items-center gap-2' as const

/** 「오늘의 미션」 제목 텍스트 */
export const MISSION_TODAY_TITLE_HEADING_CLASSNAME =
  'min-w-0 truncate text-sm font-black leading-tight text-brand-text' as const

/** EXP 막대·♥·숫자 묶음 */
export const MISSION_TODAY_EXP_GROUP_CLASSNAME =
  'flex min-w-0 min-h-[11px] flex-1 flex-nowrap items-center justify-end gap-1' as const

/** EXP 진행 막대 트랙 */
export const MISSION_TODAY_EXP_TRACK_CLASSNAME =
  'relative h-[11px] w-0 min-w-0 max-w-[14rem] flex-1 overflow-hidden rounded-full bg-white/50 shadow-inner ring-1 ring-pink-300/40' as const

/** EXP 막대 채움 */
export const MISSION_TODAY_EXP_FILL_CLASSNAME =
  'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pink-300 to-pink-500 transition-all duration-500' as const

/** 막대 안 현재 EXP 숫자 */
export const MISSION_TODAY_EXP_TEXT_IN_BAR_CLASSNAME =
  'absolute left-1 top-1/2 z-10 -translate-y-1/2 text-[9px] font-black tabular-nums leading-none text-pink-950 drop-shadow-[0_0_2px_rgba(255,255,255,0.95)]' as const

/** 막대 오른쪽 ♥ 목표치 */
export const MISSION_TODAY_EXP_TO_NEXT_CLASSNAME =
  'flex shrink-0 items-center gap-0.5 pr-0.5 text-[10px] font-black tabular-nums text-pink-700 sm:text-[11px]' as const

/**
 * 가로 스크롤 미션 카드 행 — 스와이프는 유지하되 **스크롤바(슬라이드바)는 숨김**.
 */
export const MISSION_CARD_SCROLLER_CLASSNAME =
  'flex min-h-0 min-w-0 w-full flex-none snap-x snap-mandatory items-start gap-1 overflow-x-auto py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' as const

/**
 * 미션 카드 버튼 — 테두리(일반/특별)만 컴포넌트에서 덧붙입니다.
 * 너비·최소 높이·내부 세로 간격(gap-y)·패딩이 카드 비율의 핵심입니다.
 */
export const MISSION_CARD_BUTTON_BASE_CLASSNAME =
  'snap-center flex w-[min(24vw,104px)] min-h-[7rem] shrink-0 flex-col items-stretch gap-y-1.5 overflow-hidden rounded-lg border bg-white p-1.5 text-left font-sans text-brand-text shadow-md transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-1 active:scale-[0.97]' as const

/** 카드 상단 루틴 일러스트 영역(높이 하한 = 이미지·텍스트 비율 고정) */
export const MISSION_CARD_IMAGE_AREA_CLASSNAME =
  'flex min-h-[3.35rem] w-full shrink-0 items-center justify-center overflow-visible' as const

/** 루틴 아틀라스 썸네일 가로 크기(px) — 영역 높이와 함께 비율 고정 */
export const MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX = 42

/** 제목·부제 묶음 */
export const MISSION_CARD_TEXT_BLOCK_CLASSNAME = 'shrink-0 space-y-0.5 px-px text-center' as const

/** 카드 제목 두 줄까지 */
export const MISSION_CARD_TITLE_CLASSNAME =
  'line-clamp-2 text-[8px] font-black leading-snug text-brand-text' as const

/** 카드 부제 한 줄 */
export const MISSION_CARD_SUBTITLE_CLASSNAME =
  'line-clamp-1 text-[7px] font-medium leading-snug text-gray-500' as const

/** 크레딧·EXP 알약 줄 바깥 중앙 정렬 */
export const MISSION_CARD_REWARD_ROW_CLASSNAME = 'flex shrink-0 justify-center' as const

/** 알약 공통(배경만 일반/특별로 나뉨) */
export const MISSION_CARD_REWARD_PILL_BASE_CLASSNAME =
  'inline-flex max-w-full flex-nowrap items-center justify-center gap-x-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black tabular-nums tracking-tight text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06]' as const

/** 알약 안 동전·하트 아이콘 가로(px) */
export const MISSION_CARD_REWARD_ICON_WIDTH_PX = 12
