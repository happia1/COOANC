/** 영상 시청권 1장 = 30분 */
export const VIDEO_PASS_MINUTES = 30
export const VIDEO_PASS_SECONDS = VIDEO_PASS_MINUTES * 60

export function isVideoViewingPassStoreItem(
  name: string | null | undefined,
  category?: string | null,
): boolean {
  if (category === 'content' && name?.includes('영상')) return true
  return (
    name === '영상 시청권 30분' ||
    name === '콘텐츠 30분 이용권' ||
    name === '콘텐츠 이용권 30분'
  )
}

/** 분 단위 → 「1시간 30분」「30분」 */
export function formatWatchMinutesLabel(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes))
  if (safe <= 0) return '0분'
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`
  if (hours > 0) return `${hours}시간`
  return `${minutes}분`
}

/** 초 → 시청 시간 라벨 */
export function formatWatchSecondsLabel(totalSeconds: number): string {
  return formatWatchMinutesLabel(Math.ceil(Math.max(0, totalSeconds) / 60))
}

/** 초 → 「30:00」「90:00」 시계 형식 (시청 가능 시간 표시용) */
export function formatWatchTimeClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 보유 시청권·풀·진행 중 세션을 합친 총 시청 가능 초 */
export function totalVideoWatchSecondsFromBalances(
  ticketQuantity: number,
  watchSecondsPool: number,
  activeSessionSeconds: number,
): number {
  if (activeSessionSeconds > 0 || watchSecondsPool > 0) {
    return watchSecondsPool + activeSessionSeconds
  }
  return Math.max(0, ticketQuantity) * VIDEO_PASS_SECONDS
}

/** 구매 수량 → 총 시청 가능 시간 라벨 */
export function formatVideoPassPurchaseDuration(quantity: number): string {
  return formatWatchMinutesLabel(quantity * VIDEO_PASS_MINUTES)
}
