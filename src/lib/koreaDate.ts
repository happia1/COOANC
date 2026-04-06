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

/** 서울 달력 날짜(YYYY-MM-DD)에 해당하는 요일 — 짧은 한글 (일~토) */
const KO_WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * `isoDate` 는 앱 전역에서 쓰는 **서울 기준 달력 날짜** 문자열이어야 합니다.
 * 그날 정오(KST) 시각을 기준으로 요일을 구해, 경계(자정)에서 하루가 밀리지 않게 합니다.
 */
export function getSeoulWeekdayShort(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return '?'
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return '?'
  // 정오 KST = UTC 03:00 같은 달력일 → getUTCDay() 가 그 날의 요일과 일치
  const utcNoonKst = Date.UTC(y, mo - 1, d, 3, 0, 0)
  const idx = new Date(utcNoonKst).getUTCDay()
  return KO_WEEKDAY_SHORT[idx]
}
