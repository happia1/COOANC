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
 * DB에 저장된 완료 시각(ISO 문자열 등)을 **서울 달력 날짜** YYYY-MM-DD 로 바꿉니다.
 * - 화면에 `completed_at.slice(0, 10)` 만 쓰면 UTC 날짜라, 한국 새벽·자정 직후에 어제 날짜로 보일 수 있습니다.
 */
export function getSeoulDateFromIsoTimestamp(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return getSeoulDateString(d)
}

/**
 * DB·Supabase Realtime 이 넘기는 `date` / `timestamptz` 값을 서울 기준 YYYY-MM-DD 키로 맞춥니다.
 * - `date` 컬럼이 "2026-04-27" 로 오면 그대로 사용
 * - ISO 문자열이면 서울 달력 날짜로 변환(한국 자정 전후 오판 방지)
 *
 * 비개발자 설명: 데이터베이스에서 오는 「날짜」표현이 조금씩 달라도, 앱 안에서는 항상 같은 형식으로 비교해요.
 */
export function toYyyyMmDdDbValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const s = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
      const head = s.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
    }
    return getSeoulDateFromIsoTimestamp(s)
  }
  return null
}

/** Postgres boolean 이 문자열 등으로 올 때도 「완료 아님」을 안전히 판별합니다. */
export function dbValueMeansIncomplete(isCompleted: unknown): boolean {
  /**
   * Realtime `payload.new` 에서 컬럼이 빠졌거나(null/undefined) — 불완료가 아니라 「정보 없음」으로 보고 롤백하지 않습니다.
   * 비개발자: 여기서 잘못 판단하면 완료한 카드가 갑자기 다시 보일 수 있습니다.
   */
  if (isCompleted === undefined || isCompleted === null) return false
  if (isCompleted === false) return true
  if (isCompleted === true) return false
  if (typeof isCompleted === 'string') {
    const s = isCompleted.toLowerCase()
    if (s === 'false' || s === 'f' || s === '0' || s === '') return true
    if (s === 'true' || s === 't' || s === '1') return false
  }
  return !isCompleted
}

/**
 * 서울 기준 현재 시각을 `HH:MM`(24시간)으로 돌려줍니다.
 * 루틴 알람(기상 시각)과 문자열 비교할 때 사용합니다.
 */
export function getSeoulTimeHHMM(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
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

/**
 * 지금 시각부터 **서울 달력**이 다음 날 0시가 되기까지 남은 밀리초입니다.
 * - 한국은 일광절약시간이 없어 `+09:00` 고정으로 다음날 자정을 잡습니다.
 * - 탭을 밤새 켜 둔 경우 `setTimeout`으로 목록이 자정에 맞춰 비우도록 쓸 때 사용합니다.
 */
export function getMsUntilNextSeoulMidnight(now: Date = new Date()): number {
  const todaySeoul = getSeoulDateString(now)
  const nextDaySeoul = addSeoulCalendarDays(todaySeoul, 1)
  const nextMidnightKst = new Date(`${nextDaySeoul}T00:00:00+09:00`)
  return Math.max(0, nextMidnightKst.getTime() - now.getTime())
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

/**
 * 해당 서울 달력 날짜가 속한 주의 **월요일** 날짜(YYYY-MM-DD)를 돌려줍니다.
 * - 한 주는 월요일~일요일로 잡습니다(부모 홈 루틴 막대와 동일).
 * - JavaScript `getUTCDay()`는 일=0 … 토=6 이라, 월요일까지 거슬러 올라갈 일수는 `(요일+6)%7` 입니다.
 */
export function getSeoulMondayOfWeekContaining(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return isoDate
  const utcNoonKst = Date.UTC(y, mo - 1, d, 3, 0, 0)
  const weekday = new Date(utcNoonKst).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  return addSeoulCalendarDays(isoDate, -daysSinceMonday)
}
