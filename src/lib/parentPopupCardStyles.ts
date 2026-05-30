/**
 * 부모 앱 중앙 팝업 카드(공지·구매 알림·승인 안내 등) 공통 크기·모양.
 * - 너비·높이를 맞춰 팝업마다 카드 크기가 달라 보이지 않게 합니다.
 */

/** 오버레이: 화면 가운데 정렬 */
export const PARENT_POPUP_OVERLAY =
  'fixed inset-0 flex items-center justify-center p-4 px-5' as const

/** 반투명 배경(클릭으로 닫기 등은 각 컴포넌트에서 처리) */
export const PARENT_POPUP_BACKDROP = 'absolute inset-0 bg-black/45' as const

/**
 * 카드 껍데기 — 모든 중앙 팝업이 같은 너비·높이를 씁니다.
 * 내용이 적으면 아래쪽이 비고, 많으면 본문 영역만 스크롤합니다.
 */
export const PARENT_POPUP_CARD =
  'relative z-10 flex w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white shadow-2xl h-[min(22rem,85dvh)] min-h-[22rem]' as const

/** 카드 본문 영역 — 스크롤바 없이 남는 높이만 채움(넘치면 각 팝업에서 잘림·더보기 처리) */
export const PARENT_POPUP_CARD_BODY = 'min-h-0 flex-1 overflow-hidden' as const

/** 팝업 하단 액션 버튼 공통 크기(링크·확인·나중에 등) */
export const PARENT_POPUP_BTN =
  'flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-black leading-tight transition active:scale-[0.98]' as const

export const PARENT_POPUP_BTN_SOLO =
  'flex min-h-[2.75rem] w-full items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-black leading-tight transition active:scale-[0.98]' as const
