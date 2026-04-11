/**
 * 미션 완료율 → 하트 개수(0~5) 변환
 * 90% 이상 달성 시 5개, 이하 18%당 1개씩 증가
 */
export function completionRateToHearts(completed: number, total: number): number {
  if (total === 0) return 0
  const pct = completed / total
  if (pct >= 0.9) return 5
  return Math.floor(pct / 0.18) // 0~17%=0, 18~35%=1, 36~53%=2, 54~71%=3, 72~89%=4
}
