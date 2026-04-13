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
 *   - 가로 px-3, 세로 pt-0.5 pb-2.5, 블록 간 gap-0.5, overflow-x-hidden·**overflow-y-hidden**(미션 탭 전체 세로 스크롤 방지), `min-h-0 flex-1`
 * • 제목·하트 줄 `MISSION_TODAY_TITLE_ROW_OUTER/INNER` + (카드용) EXP 트랙·글자 클래스
 *   - 제목 래퍼 가로 pl-2 pr-2, 세로 `-mt-1 pt-0`(위로는 살짝만 — 상단바 z-40 아래 `main` 안에서는 과한 `-mt` 가 글을 가림)
 *   - `relative z-[30]`: 저금통 줄(z-0)보다 앞
 *   - 한 행: 「오늘의 미션」은 왼쪽, EXP 하트 5개는 `justify-between` 으로 오른쪽 정렬, gap-2
 *   - 카드 막대: 높이 11px·max-w-[14rem], ♥ 쪽 글자 10px(sm 11px) 등
 * • 카드 가로 스크롤 `MISSION_CARD_SCROLLER_CLASSNAME`
 *   - 카드 간 gap-0.5(조밀), 스크롤 안쪽 pl-2 pr-2 (= 제목 래퍼와 동일, 그림자 잘림 방지)
 *
 * ── 미션 카드 본문 비율·간격 ──
 * • 카드 버튼 `MISSION_CARD_BUTTON_BASE_CLASSNAME`
 *   - 너비·그림자·링 동일. 안쪽 좌우 px-1.5·상하 py-1. 카드·이미지 영역 min-h 는 일러스트(px 상수)에 맞춤. **(그림+제목) 묶음** ↔ **보상 줄** 은 gap-y-1.5
 * • 그림↔제목 간격: `MISSION_CARD_IMAGE_TEXT_STACK_CLASSNAME` (gap-y-0 — 이미지 바로 아래에 글 붙임)
 * • 이미지 영역 `MISSION_CARD_IMAGE_AREA_CLASSNAME` + `MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX` (=78, 42의 2배 84에서 살짝 축소)
 * • 텍스트 `MISSION_CARD_TEXT_BLOCK/TITLE/SUBTITLE` — 줄 수·글자 크기(8px/7px)·space-y-0.5
 * • 보상 알약 `MISSION_CARD_REWARD_*` — px-1.5 py-0.5, gap-x-0.5, 아이콘 12px
 *
 * 상·하 flex 비율 5.5:4.5 는 `MISSION_TAB_VERTICAL_SPLIT` 으로 활성 사용 중.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/** 미션 탭 상(크레딧 카드)·하(오늘의 미션) flex 비율 — 5.5 : 4.5 */
export const MISSION_TAB_VERTICAL_SPLIT = {
  upperFlexGrow: 5.5,
  lowerFlexGrow: 4.5,
} as const

/** 크레딧 카드 상단 영역 flex-grow */
export const MISSION_TAB_SCENERY_FLEX_WEIGHT: 5.5 = MISSION_TAB_VERTICAL_SPLIT.upperFlexGrow

/** 오늘의 미션 하단 영역 CSSProperties (flex-[4.5] 상당) */
export function missionTabLowerPanelFlexStyle(): CSSProperties {
  return {
    flexGrow: MISSION_TAB_VERTICAL_SPLIT.lowerFlexGrow,
    flexShrink: 1,
    flexBasis: '0%',
    minHeight: 0,
  }
}

/** 「오늘의 미션」 하단 섹션 — 픽스 패딩. 세로 스크롤은 `MissionTab` 안 제목 **아래** 래퍼만 담당. */
export const MISSION_TODAY_BOTTOM_SECTION_CLASSNAME =
  'relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-hidden px-3 pb-2.5 pt-0.5' as const

/**
 * 제목·하트 한 줄 바깥 — 가로는 카드 스크롤러와 맞춤(pl-2 pr-2).
 * `-mt-1` + `pt-0`: 저금통과 살짝만 겹침. `relative z-[30]`: 크레딧 줄(z-0)보다 앞(상단바는 main 밖 z-40 이라 과한 음수 마진은 피함).
 */
export const MISSION_TODAY_TITLE_ROW_OUTER_CLASSNAME =
  'relative z-[30] w-full min-w-0 shrink-0 pl-2 pr-2 pb-0.5 pt-0 -mt-1' as const

/** 제목·하트 5개를 한 행에 넣는 flex 컨테이너 — `justify-between` 으로 제목은 왼쪽, 하트 묶음은 오른쪽 끝에 둡니다 */
export const MISSION_TODAY_TITLE_ROW_INNER_CLASSNAME =
  'flex w-full min-w-0 flex-nowrap items-center justify-between gap-2' as const

/** 「오늘의 미션」 제목 텍스트 — `flex-1 min-w-0` 로 남는 가로를 쓰며 길면 말줄임(하트와 겹침 방지) */
export const MISSION_TODAY_TITLE_HEADING_CLASSNAME =
  'min-w-0 flex-1 truncate text-sm font-black leading-tight text-brand-text' as const

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

/** 가로 카드 행 — gap-0.5 로 카드 사이 간격 축소, pl-2 pr-2 유지(제목 줄과 기준선 정렬). 스크롤바 숨김. */
export const MISSION_CARD_SCROLLER_CLASSNAME =
  'flex min-h-0 min-w-0 w-full flex-none snap-x snap-mandatory items-start gap-0.5 overflow-x-auto py-0 pl-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' as const

/**
 * 미션 카드 버튼 본체 — gap·텍스트·보상 알약·패딩(px-1.5 py-1) 유지.
 * **min-h** 는 이미지 영역을 낮춘 만큼 함께 줄여 카드가 전체적으로 짧아 보이게 함(내용은 그대로 들어감).
 * 미션 일러스트 78px + 좌우 12px → 최소 너비는 w max(6.5rem,…) 등으로 여유 있게.
 */
export const MISSION_CARD_BUTTON_BASE_CLASSNAME =
  'snap-center flex w-[max(5rem,min(30vw,5.5rem))] min-h-[8.5rem] shrink-0 flex-col items-stretch gap-y-1.5 overflow-hidden rounded-lg border bg-white px-1.5 py-1 text-left font-sans text-brand-text shadow-md transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-1 active:scale-[0.97]' as const

/**
 * 일러스트 블록과 제목·부제 블록을 세로로만 묶습니다.
 * 버튼의 gap-y-1.5 는 이 묶음 전체와 **보상 알약 줄** 사이에만 적용되고, 그림과 글 사이는 gap-y-0 으로 최대한 붙입니다.
 */
export const MISSION_CARD_IMAGE_TEXT_STACK_CLASSNAME =
  'flex w-full min-w-0 shrink-0 flex-col gap-y-0' as const

/**
 * 카드 상단 루틴 일러스트 영역 — 78px(약 4.875rem) 정사각이 잘리지 않게 **5.5rem** 정도만 확보(위·아래 여백 최소).
 */
export const MISSION_CARD_IMAGE_AREA_CLASSNAME =
  'flex min-h-[5.5rem] w-full shrink-0 items-center justify-center overflow-visible' as const

/** 루틴 PNG / 아틀라스 썸네일 한 변 길이(px) — 정사각형 렌더(84에서 살짝 축소) */
export const MISSION_CARD_ROUTINE_SPRITE_WIDTH_PX = 78

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

// ── 게임 레이어 추가 상수 (하트 시스템) ──────────────────────────────────────

/** 제목 옆 하트 5개 그룹 래퍼 */
export const MISSION_TODAY_HEARTS_GROUP_CLASSNAME =
  'flex shrink-0 items-center gap-0.5 pr-0.5' as const
