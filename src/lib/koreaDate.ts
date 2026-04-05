/**
 * 앱 기본 타임존: Asia/Seoul
 * - `toISOString().split('T')[0]` 는 UTC 기준이라 한국 밤/새벽에 날짜가 하루 어긋날 수 있음
 */

/** 서울 기준 달력 날짜 YYYY-MM-DD */
export function getSeoulDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * YYYY-MM-DD 에 정수 일수를 더함 (UTC 달력 연산 후 다시 서울 날짜 문자열로 변환)
 * 스트릭용 "어제" 등에 사용
 */
export function addSeoulCalendarDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const u = Date.UTC(y, m - 1, d + deltaDays)
  return getSeoulDateString(new Date(u))
}

/** YYYY-MM-DD → 화면용 YYYY.MM.DD */
export function formatDateDot(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  return isoDate.replace(/-/g, '.')
}
