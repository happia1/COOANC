import type { CSSProperties } from 'react'

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 오늘의 미션(미션 탭 하단) — **픽스(확정) UI 스펙**
 *
 * 기획·디자인 합의 없이 아래에 해당하는 **클래스·픽셀·간격**을 바꾸지 마세요.
 * 코드 리뷰·AI 도구도 이 파일만 단일 출처로 보고, `MissionTab` 에 임의 Tailwind 를
 * 추가하지 않도록 유지하세요.
 *
 * ── 바깥·패딩(겹침·클리핑과 연동) ──
 * • 하단 섹션 `MISSION_TODAY_BOTTOM_SECTION_CLASSNAME`
 *   - 가로 px-3, 세로 pt-0.5 pb-2.5, 블록 간 gap-0.5, 위로 -mt-12, overflow-x-hidden
 * • 제목·EXP 줄 `MISSION_TODAY_TITLE_ROW_OUTER/INNER` + EXP 트랙·글자 클래스
 *   - 제목 래퍼 가로 pl-2 pr-2 (섹션 px-3 과 합쳐 기준선 고정)
 *   - 한 행 gap-2, 막대 높이 11px·max-w-[14rem], ♥ 쪽 글자 10px(sm 11px) 등
 * • 카드 가로 스크롤 `MISSION_CARD_SCROLLER_CLASSNAME`
 *   - 카드 간 gap-1, 스크롤 안쪽 pl-2 pr-2 (= 제목 래퍼와 동일, 그림자 잘림 방지)
 *
 * ── 미션 카드 본문 비율·간격 ──
 * • 카드 버튼 `MISSION_CARD_BUTTON_BASE_CLASSNAME`
 *   - 너비 w-[min(24vw,104px)], 최소 높이 min-h-[7rem], 세로 gap-y-1.5, 안쪽 p-1.5, 그림자·링
 * • 이미지 영역 `MISSION_CARD_IMAGE_AREA_CLASSNAME` + `MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX` (=42)
 * • 텍스트 `MISSION_CARD_TEXT_BLOCK/TITLE/SUBTITLE` — 줄 수·글자 크기(8px/7px)·space-y-0.5
 * • 보상 알약 `MISSION_CARD_REWARD_*` — px-1.5 py-0.5, gap-x-0.5, 아이콘 12px
 *
 * (예전 상·하 flex 비율 5.5:4.5 는 `MISSION_TAB_VERTICAL_SPLIT` 참고용·현 미션 탭 미사용.)
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

/** 「오늘의 미션」 하단 섹션 — 픽스 패딩·겹침. 세로 스크롤은 `MissionTab` 루트가 담당. (상단 스펙 목록 준수) */
export const MISSION_TODAY_BOTTOM_SECTION_CLASSNAME =
  'relative z-10 -mt-12 flex min-w-0 shrink-0 flex-col gap-0.5 overflow-x-hidden overflow-y-visible px-3 pb-2.5 pt-0.5 sm:-mt-12' as const

/** 제목·EXP 줄 바깥 — 픽스 pl-2 pr-2 (카드 스크롤러와 기준선 동일). */
export const MISSION_TODAY_TITLE_ROW_OUTER_CLASSNAME =
  'w-full min-w-0 shrink-0 pl-2 pr-2 pb-0.5 pt-0.5' as const

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

/** 가로 카드 행 — 픽스 gap-1·pl-2 pr-2, 스크롤바 숨김. (상단 스펙 목록 준수) */
export const MISSION_CARD_SCROLLER_CLASSNAME =
  'flex min-h-0 min-w-0 w-full flex-none snap-x snap-mandatory items-start gap-1 overflow-x-auto py-0 pl-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' as const

/** 미션 카드 버튼 본체 — 픽스 너비·높이·gap·p (테두리만 일반/특별 분기). */
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
