/**
 * 부모 앱 UI — 일정 브리핑의 앰버 박스를 제외한 **중립 흰 카드** 스타일 단일 출처.
 * - 홈: 오늘의 진행도, 경제 EQ 패널(EQ 지수 종합·주간 루틴+완주율)
 * - 루틴 탭: 일상(오전/오후)·스페셜 카드 바깥 래퍼
 *
 * 비개발자용: 같은 종류의 “흰 네모 카드”는 여기 정의와 똑같이 보이게 맞춥니다.
 */

/**
 * 패딩은 각 섹션에서 `px-3 py-3` 등으로 덧붙입니다.
 * 캘린더 블록과 동일한 스타일(둥근 모서리 rounded-2xl + 연한 그림자)로 통일 — 부모 앱 모든 블록 공통.
 */
export const PARENT_NEUTRAL_CARD_CLASSNAME =
  'rounded-2xl bg-white shadow-sm' as const

/**
 * 안쪽에 가로 스크롤(미션 칩 줄)이 있을 때 바깥 루트용 — 좌우 클리핑만 추가.
 */
export const PARENT_NEUTRAL_CARD_OVERFLOW_X_CLASSNAME =
  'overflow-x-hidden rounded-2xl bg-white shadow-sm' as const
