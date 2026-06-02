/**
 * 자녀 홈 레벨 블록·저금통 팝업 등에서 **같은 크레딧 아이콘·숫자 형식**을 쓰기 위한 공통 정의
 *
 * 비개발자 설명:
 * - 왼쪽 위 레벨 카드에 보이는 동전 그림과 숫자 표기를 저금통 화면에서도 그대로 재사용합니다.
 */

/** 레벨 블록(`ChildLevelStatsCard`)과 동일한 크레딧 동전 PNG */
export const CHILD_CREDIT_COIN_PNG_SRC =
  `/assets/img/common/ui/${encodeURIComponent('크레딧.png')}` as const

/** 레벨 블록과 동일한 크레딧 숫자 표기(1만 이상은 「N만」) */
export function formatChildCreditsDisplay(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}만`
  return value.toLocaleString('ko-KR')
}
