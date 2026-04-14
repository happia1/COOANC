/**
 * 루틴 도우미 — **로컬(브라우저)에서만** 일정 문자열을 해석합니다.
 * - 날짜·행사 키워드가 분명하면 Gemini 없이 JSON 을 만들고,
 * - 애매하면 `shouldCallAPI` 가 true 가 되어 서버 `/agent-b/parse` 로 넘깁니다.
 */

import type { AgentParseEvent, AgentParseResponse, AgentParseSuggestion } from '@/lib/agentApi'
import {
  addSeoulCalendarDays,
  getSeoulDateString,
  getSeoulMondayOfWeekContaining,
  getSeoulWeekdayShort,
} from '@/lib/koreaDate'
import { agentParseTypeToLocalEventType } from '@/lib/syncAgentEventToLocalCalendar'
import type { LocalCalendarEvent } from '@/types/database'

/** 직접 입력 폼 감사 문자열에만 붙이는 토큰 — `shouldCallAPI` 가 키워드 조건을 통과하도록 함 */
const DIRECT_FORM_AUDIT_TAG = '직접입력'

/** 에이전트/DB 와 맞춘 이벤트 유형 코드 */
export type EventType = 'school' | 'holiday' | 'vacation' | 'travel' | 'birthday' | 'hospital' | 'etc'

/** `buildScheduleFromText` 결과 — 서버 JSON 과 같은 필드 이름 */
export type LocalBuiltSchedule = {
  title: string
  start_date: string
  end_date: string
  event_type: EventType
  note: string
  routine_off: boolean
}

const AMBIGUOUS = /다음달쯤|곧|언젠가|미정|추후|언제든|나중에|대략|쯤이면|아마/

const CONJ = /(그리고|하지만|그런데|및|또한|그러나|또|그래서|그런|하지만|그러면)/g

/** 일정 의도 판단용 최소 키워드(요청 사양) */
const SCHEDULE_INTENT_WORDS = [
  '등록',
  '추가',
  '넣어',
  '일정',
  '행사',
  '여행',
  '방학',
  '병원',
  '체육',
  '소풍',
  '기념일',
  '생일',
  '학교',
  '유치원',
  '출발',
  '도착',
  '예약',
]

/** 키워드 길이 내림차순으로 매칭하기 위해 정렬된 목록 */
const KEYWORD_GROUPS: { type: EventType; words: string[] }[] = [
  {
    type: 'school',
    words: [
      '체육대회',
      '운동회',
      '체육의날',
      '발표회',
      '학예회',
      '재롱잔치',
      '참관수업',
      '참여수업',
      '공개수업',
      '소풍',
      '현장학습',
      '견학',
      '체험학습',
      '입학식',
      '졸업식',
      '수료식',
      '종업식',
      '시업식',
      '개학',
      '방과후',
      '돌봄',
      '유치원',
      '어린이집',
      '어린이날행사',
      '교사연수',
      '재량휴업',
      '자율휴업',
      '학교',
      '등교',
      '하교',
      '성적표',
      '통지표',
      '상담주간',
      '코스변경',
      '버스운행',
      '급식',
    ],
  },
  {
    type: 'holiday',
    words: [
      '공휴일',
      '대체공휴일',
      '대체휴일',
      '국경일',
      '임시공휴일',
      '설날',
      '설연휴',
      '추석',
      '추석연휴',
      '어린이날',
      '어버이날',
      '스승의날',
      '현충일',
      '광복절',
      '개천절',
      '한글날',
      '크리스마스',
      '성탄절',
      '신정',
      '새해',
      '연휴',
      '징검다리연휴',
    ],
  },
  {
    type: 'vacation',
    words: [
      '여름방학',
      '겨울방학',
      '봄방학',
      '방학숙제',
      '방학계획',
      '방학',
      '휴가',
      '여름휴가',
      '가족휴가',
      '쉬는날',
      '쉼',
    ],
  },
  {
    type: 'travel',
    words: [
      '해외여행',
      '놀이공원',
      '에버랜드',
      '롯데월드',
      '워터파크',
      '리조트',
      '글램핑',
      '제주도',
      '부산',
      '강릉',
      '속초',
      '경주',
      '강원도',
      '제주',
      '남해',
      '통영',
      '캠핑',
      '펜션',
      '나들이',
      '여행',
      '해외',
      '일본',
      '오사카',
      '도쿄',
      '후쿠오카',
      '태국',
      '방콕',
      '괌',
      '하와이',
      '미국',
      '유럽',
      '싱가포르',
    ],
  },
  {
    type: 'birthday',
    words: [
      '생일파티',
      '생일잔치',
      '결혼기념일',
      '입학기념',
      '생일',
      '기념일',
      '돌잔치',
      '백일',
      '돌',
    ],
  },
  {
    type: 'hospital',
    words: [
      '예방접종',
      '독감주사',
      '독감백신',
      '건강검진',
      '검진',
      '진료',
      '한의원',
      '정형외과',
      '안과',
      '입원',
      '수술',
      '통원',
      '소아과',
      '이비인후과',
      '치과',
      '병원',
    ],
  },
  /** 폼에서 온 짧은 문장도 `hasMappedKeyword` 를 만족시키기 위한 최소 토큰(일반 채팅에 잘 안 씀) */
  {
    type: 'etc',
    words: [DIRECT_FORM_AUDIT_TAG],
  },
]

function sortedKeywords(): { type: EventType; word: string }[] {
  const out: { type: EventType; word: string }[] = []
  for (const g of KEYWORD_GROUPS) {
    for (const w of g.words) {
      out.push({ type: g.type, word: w })
    }
  }
  out.sort((a, b) => b.word.length - a.word.length)
  return out
}

const SORTED_KW = sortedKeywords()

/** 문장에서 첫 매칭 키워드의 유형과 단어 */
export function classifyEvent(input: string): EventType {
  const t = input.replace(/\s+/g, '')
  for (const { type, word } of SORTED_KW) {
    if (t.includes(word)) return type
  }
  return 'etc'
}

function matchedKeyword(input: string): string | null {
  const t = input.replace(/\s+/g, '')
  for (const { word } of SORTED_KW) {
    if (t.includes(word)) return word
  }
  return null
}

/** school + 특정 키워드면 루틴 끄기 */
function routineOffFor(eventType: EventType, textNorm: string): boolean {
  if (eventType === 'holiday' || eventType === 'vacation' || eventType === 'travel') return true
  if (eventType === 'school') {
    if (/재량휴업|자율휴업|교사연수/.test(textNorm)) return true
    return false
  }
  if (eventType === 'birthday' || eventType === 'hospital') return false
  return false
}

function seoulYmdFromParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const u = Date.UTC(y, m - 1, d)
  const dt = new Date(u)
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return getSeoulDateString(dt)
}

/** `YYYY-MM-DD` 한 덩어리만 뽑을 때 사용(첫 일정의 시작일) */
export function parseDate(input: string): string {
  const r = extractDateRange(input)
  return r?.start ?? ''
}

function parseAbsoluteYmd(text: string, baseYear: number, baseMonth: number): string | null {
  const compact = text.replace(/\s+/g, '')

  let m = /(\d{4})년(\d{1,2})월(\d{1,2})일/.exec(compact)
  if (m) return seoulYmdFromParts(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /(\d{2})년(\d{1,2})월(\d{1,2})일/.exec(compact)
  if (m) return seoulYmdFromParts(2000 + Number(m[1]), Number(m[2]), Number(m[3]))

  m = /(\d{1,2})월(\d{1,2})일/.exec(compact)
  if (m) return seoulYmdFromParts(baseYear, Number(m[1]), Number(m[2]))

  m = /(\d{1,2})[./-](\d{1,2})(?![./-]?\d{4})/.exec(compact)
  if (m) return seoulYmdFromParts(baseYear, Number(m[1]), Number(m[2]))

  m = /(\d{4})-(\d{2})-(\d{2})/.exec(compact)
  if (m) return seoulYmdFromParts(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /(\d{2})-(\d{2})-(\d{2})/.exec(compact)
  if (m) return seoulYmdFromParts(2000 + Number(m[1]), Number(m[2]), Number(m[3]))

  m = /^(\d{1,2})일$/.exec(compact)
  if (m) return seoulYmdFromParts(baseYear, baseMonth, Number(m[1]))

  return null
}

function weekdayIndex(ko: string): number | null {
  const map: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }
  return map[ko] ?? null
}

/** 서울 달력 `YYYY-MM-DD` 의 요일 (0=일 … 6=토) */
function seoulCalendarDow(iso: string): number {
  const s = getSeoulWeekdayShort(iso)
  return '일월화수목금토'.indexOf(s)
}

/** 오늘(서울)부터 가장 가까운 해당 요일(당일 포함) */
function nextWeekdayFromTodaySeoul(dow: number): string {
  const today = getSeoulDateString()
  const cur = seoulCalendarDow(today)
  const add = (dow - cur + 7) % 7
  return addSeoulCalendarDays(today, add)
}

function nextSaturdayStartSundayEndSeoul(): { start: string; end: string } {
  const today = getSeoulDateString()
  const cur = seoulCalendarDow(today)
  const sat = 6
  const add = (sat - cur + 7) % 7
  const satIso = addSeoulCalendarDays(today, add)
  return { start: satIso, end: addSeoulCalendarDays(satIso, 1) }
}

function parseRelativePhrase(text: string): string | null {
  const c = text.replace(/\s+/g, '')
  if (/오늘/.test(c)) return getSeoulDateString()
  if (/내일/.test(c)) return addSeoulCalendarDays(getSeoulDateString(), 1)
  if (/모레/.test(c)) return addSeoulCalendarDays(getSeoulDateString(), 2)
  if (/글피/.test(c)) return addSeoulCalendarDays(getSeoulDateString(), 3)

  const mWeek =
    /(이번주|다음주|다다음주)(월|화|수|목|금|토|일)요?일?/.exec(c) ||
    /(이번주|다음주|다다음주)(월|화|수|목|금|토|일)/.exec(c)
  if (mWeek) {
    const which = mWeek[1]
    const wd = weekdayIndex(mWeek[2])
    if (wd == null) return null
    let base = nextWeekdayFromTodaySeoul(wd)
    if (which === '이번주') return base
    if (which === '다음주') return addSeoulCalendarDays(base, 7)
    if (which === '다다음주') return addSeoulCalendarDays(base, 14)
  }

  if (/이번주말|이번주\s*말/.test(c)) {
    return nextSaturdayStartSundayEndSeoul().start
  }
  if (/다음주말|다음주\s*말/.test(c)) {
    const { start } = nextSaturdayStartSundayEndSeoul()
    return addSeoulCalendarDays(start, 7)
  }

  return null
}

/** 해당 연·월의 마지막 날짜(서울 달력) */
function lastDayOfMonthSeoul(year: number, month: number): number {
  const u = Date.UTC(year, month, 0)
  return new Date(u).getUTCDate()
}

/** 시즌 키워드만 있고 구체 일자가 없을 때 대략 범위(요구사항의 ‘연도 기준 예상’) */
function seasonVacationRangeIfNoExplicitDate(text: string, baseYear: number, baseMonth: number): { start: string; end: string } | null {
  const c = text.replace(/\s+/g, '')
  if (parseAbsoluteYmd(text, baseYear, baseMonth)) return null
  if (/방학\s*기간/.test(text)) return null
  if (/여름방학/.test(c)) {
    const s = seoulYmdFromParts(baseYear, 7, 20)
    const e = seoulYmdFromParts(baseYear, 8, 31)
    if (s && e) return { start: s, end: e }
  }
  if (/겨울방학/.test(c)) {
    const s = seoulYmdFromParts(baseYear, 12, 20)
    const e = seoulYmdFromParts(baseYear + 1, 2, 10)
    if (s && e) return { start: s, end: e }
  }
  if (/봄방학/.test(c)) {
    const s = seoulYmdFromParts(baseYear, 2, 15)
    const e = seoulYmdFromParts(baseYear, 3, 5)
    if (s && e) return { start: s, end: e }
  }
  return null
}

/** `이번주|다음주|다다음주` 의 월요일 시작일 */
function mondayStartForWeekPhrase(which: string): string {
  const mon = getSeoulMondayOfWeekContaining(getSeoulDateString())
  if (which === '이번주') return mon
  if (which === '다음주') return addSeoulCalendarDays(mon, 7)
  if (which === '다다음주') return addSeoulCalendarDays(mon, 14)
  return mon
}

/** 해당 주(월요일 시작) 안에서 한글 요일 wd(일0…토6)에 해당하는 날짜 */
function ymdForKoWeekdayInMondayWeek(weekMonday: string, wd: number): string {
  const off = (wd + 6) % 7
  return addSeoulCalendarDays(weekMonday, off)
}

/** 시작·종료 YYYY-MM-DD (단일일이면 end === start) */
export function extractDateRange(text: string): { start: string; end: string } | null {
  const today = getSeoulDateString()
  const y = Number(today.slice(0, 4))
  const mo = Number(today.slice(5, 7))
  const c = text.replace(/\s+/g, '')

  const season = seasonVacationRangeIfNoExplicitDate(text, y, mo)
  if (season) return season

  if (/이번주\s*내내|이번주내내/.test(c)) {
    const mon = getSeoulMondayOfWeekContaining(today)
    return { start: mon, end: addSeoulCalendarDays(mon, 6) }
  }
  if (/다음주\s*내내|다음주내내/.test(c)) {
    const mon = addSeoulCalendarDays(getSeoulMondayOfWeekContaining(today), 7)
    return { start: mon, end: addSeoulCalendarDays(mon, 6) }
  }

  const mWeekSpan =
    /(이번주|다음주|다다음주)(월|화|수|목|금|토|일)요?일?\s*[~\-–]\s*(월|화|수|목|금|토|일)요?일?/.exec(c) ||
    /(이번주|다음주|다다음주)(월|화|수|목|금|토|일)\s*[~\-–]\s*(월|화|수|목|금|토|일)/.exec(c)
  if (mWeekSpan) {
    const which = mWeekSpan[1]
    const a = weekdayIndex(mWeekSpan[2])
    const b = weekdayIndex(mWeekSpan[3])
    if (a != null && b != null) {
      const wmon = mondayStartForWeekPhrase(which)
      const s = ymdForKoWeekdayInMondayWeek(wmon, a)
      const e = ymdForKoWeekdayInMondayWeek(wmon, b)
      if (s <= e) return { start: s, end: e }
      return { start: e, end: s }
    }
  }

  if (/이번달\s*말|이번달말/.test(c)) {
    const last = lastDayOfMonthSeoul(y, mo)
    const iso = seoulYmdFromParts(y, mo, last)
    if (iso) return { start: iso, end: iso }
  }
  const nm = mo === 12 ? 1 : mo + 1
  const ny = mo === 12 ? y + 1 : y
  if (/다음달\s*초|다음달초/.test(c)) {
    const s = seoulYmdFromParts(ny, nm, 1)
    const e = seoulYmdFromParts(ny, nm, 5)
    if (s && e) return { start: s, end: e }
  }
  if (/다음달\s*중|다음달중/.test(c)) {
    const s = seoulYmdFromParts(ny, nm, 11)
    const e = seoulYmdFromParts(ny, nm, 20)
    if (s && e) return { start: s, end: e }
  }
  if (/다음달\s*말|다음달말/.test(c)) {
    const last = lastDayOfMonthSeoul(ny, nm)
    const iso = seoulYmdFromParts(ny, nm, last)
    if (iso) return { start: iso, end: iso }
  }

  const rel = parseRelativePhrase(text)
  if (rel) {
    if (/이번주말|이번주\s*말|다음주말|다음주\s*말/.test(c)) {
      const wk = nextSaturdayStartSundayEndSeoul()
      if (/다음주말|다음주\s*말/.test(c)) {
        return { start: addSeoulCalendarDays(wk.start, 7), end: addSeoulCalendarDays(wk.end, 7) }
      }
      return wk
    }
    return { start: rel, end: rel }
  }

  const mIsoRange = text.match(/(\d{4}-\d{2}-\d{2})\s*[~\-–]\s*(\d{4}-\d{2}-\d{2})/)
  if (mIsoRange) return { start: mIsoRange[1], end: mIsoRange[2] }

  const mVac = text.match(
    /방학\s*기간\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*[~\-–]\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/,
  )
  if (mVac) {
    const s = seoulYmdFromParts(y, Number(mVac[1]), Number(mVac[2]))
    const e = seoulYmdFromParts(y, Number(mVac[3]), Number(mVac[4]))
    if (s && e) return { start: s, end: e }
  }

  const mPeriod = text.match(
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*부터\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*까지/,
  )
  if (mPeriod) {
    const s = seoulYmdFromParts(y, Number(mPeriod[1]), Number(mPeriod[2]))
    const e = seoulYmdFromParts(y, Number(mPeriod[3]), Number(mPeriod[4]))
    if (s && e) return { start: s, end: e }
  }

  const mTilde = text.match(/(\d{1,2})[./](\d{1,2})\s*[~\-–]\s*(\d{1,2})[./](\d{1,2})/)
  if (mTilde) {
    const s = seoulYmdFromParts(y, Number(mTilde[1]), Number(mTilde[2]))
    const e = seoulYmdFromParts(y, Number(mTilde[3]), Number(mTilde[4]))
    if (s && e) return { start: s, end: e }
  }

  const single = parseAbsoluteYmd(text, y, mo)
  if (single) return { start: single, end: single }

  return null
}

function hasConfidentDatePattern(text: string): boolean {
  if (AMBIGUOUS.test(text)) return false
  return extractDateRange(text) != null
}

function hasMappedKeyword(text: string): boolean {
  return matchedKeyword(text) != null
}

/** 날짜가 있어도 문장 자체가 일정 등록 의도인지 먼저 판별합니다 */
function hasScheduleIntent(text: string): boolean {
  return SCHEDULE_INTENT_WORDS.some((w) => text.includes(w))
}

function multipleSchedulesHeuristic(text: string): boolean {
  const c = (text.match(CONJ) || []).length
  if (c >= 2) return true
  if (/\d+\)\s|①|②|③|일정\s*1|일정\s*2/.test(text)) return true
  return false
}

/**
 * Gemini `/agent-b/parse` 를 부를지 여부.
 * - 이미지가 있으면 항상 true
 */
export function shouldCallAPI(input: string, hasImage: boolean): boolean {
  if (hasImage) return true
  const t = input.trim()
  if (!t) return true
  if (t.length >= 50) return true
  if ((t.match(CONJ) || []).length >= 2) return true
  if (AMBIGUOUS.test(t)) return true
  if (multipleSchedulesHeuristic(t)) return true
  if (!hasConfidentDatePattern(t)) return true
  if (!hasMappedKeyword(t)) return true
  return false
}

/** 프론트 즉시응답용: 텍스트 입력을 API 호출 전에 1차 분류합니다 */
export function classifyTextBeforeApi(
  input: string,
): 'ok' | 'missing_date' | 'missing_content' | 'irrelevant' {
  const t = input.trim()
  if (!t) return 'irrelevant'
  const hasDate = hasConfidentDatePattern(t)
  const hasKeyword = hasMappedKeyword(t)
  const hasIntent = hasScheduleIntent(t)
  if (!hasIntent) return 'irrelevant'
  if (!hasDate && hasKeyword) return 'missing_date'
  if (hasDate && !hasKeyword) return 'missing_content'
  if (!hasDate && !hasKeyword) return 'irrelevant'
  return 'ok'
}

/** 로컬에서 만든 일정을 `postAgentParse` 와 같은 형태로 감쌉니다 */
export function buildAgentParseResponseFromLocal(schedule: LocalBuiltSchedule): AgentParseResponse {
  const suggestions: AgentParseSuggestion[] = schedule.routine_off
    ? [{ type: 'routine_off', detail: '이 날은 미션·루틴을 쉬게 할까요?', suggestion_id: null }]
    : []

  const event: AgentParseEvent = {
    type: schedule.event_type === 'hospital' ? 'etc' : schedule.event_type,
    title: schedule.title,
    start_date: schedule.start_date,
    end_date: schedule.end_date === schedule.start_date ? null : schedule.end_date,
    ...(schedule.note ? { description: schedule.note } : {}),
    routine_off: schedule.routine_off,
  }

  return {
    mode: 'single',
    type: 'single',
    schedules: null,
    event,
    suggestions,
    saved_event_id: null,
  }
}

/**
 * 날짜·키워드가 분명한 한 줄에서 일정 JSON 을 만듭니다.
 * - 실패 시 null → 호출 측에서 Gemini 로 폴백하면 됩니다.
 */
/** 직접 입력 폼에서 넘긴 `YYYY-MM-DD` 만 허용합니다 */
const YMD_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * 부모 탭 「직접 입력」폼 값으로 로컬 일정 객체를 만듭니다.
 * - `shouldCallAPI` 가 false 일 때만 쓰면 됩니다.
 * - 날짜가 잘못되면 null 을 돌려 호출 측에서 API 로 폴백할 수 있습니다.
 */
export function localBuiltScheduleFromParentForm(input: {
  title: string
  start_date: string
  end_date: string
  calendarEventType: LocalCalendarEvent['eventType']
  /** 폼의 「미션 없음」이면 true */
  routine_off: boolean
  /** 확인 카드·메모에 그대로 실을 문자열(폼 전체 블록 등) */
  note: string
}): LocalBuiltSchedule | null {
  const title = input.title.trim()
  const s = input.start_date.trim()
  const e0 = input.end_date.trim()
  if (!title || !YMD_ISO.test(s) || !YMD_ISO.test(e0)) return null
  let end = e0
  if (end < s) end = s
  const event_type: EventType =
    input.calendarEventType === 'holiday'
      ? 'holiday'
      : input.calendarEventType === 'vacation'
        ? 'vacation'
        : input.calendarEventType === 'travel'
          ? 'travel'
          : input.calendarEventType === 'event'
            ? 'school'
            : input.calendarEventType === 'special'
              ? 'birthday'
              : 'etc'
  return {
    title: title || '일정',
    start_date: s,
    end_date: end,
    event_type,
    routine_off: input.routine_off,
    note: input.note.trim(),
  }
}

/** `handleDirectSave` 가 `shouldCallAPI` 에 넘길 한 줄짜리 문자열을 만듭니다 */
export function buildDirectFormAuditLine(parts: {
  title: string
  start: string
  end: string
  eventLabel: string
  description: string
}): string {
  return [parts.title.trim(), parts.start.trim(), parts.end.trim(), parts.eventLabel.trim(), parts.description.trim(), DIRECT_FORM_AUDIT_TAG]
    .filter(Boolean)
    .join(' ')
}

export function buildScheduleFromText(input: string): LocalBuiltSchedule | null {
  const range = extractDateRange(input)
  if (!range) return null
  const eventType = classifyEvent(input)
  const kw = matchedKeyword(input)
  const title =
    kw != null
      ? kw
      : input
          .replace(/\d{1,4}년?\d{0,2}월?\d{0,2}일?/g, '')
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .trim()
          .slice(0, 40) || '일정'

  const textNorm = input.replace(/\s+/g, '')
  const routine_off = routineOffFor(eventType, textNorm)
  const note = input.trim()

  return {
    title: title || '일정',
    start_date: range.start,
    end_date: range.end,
    event_type: eventType,
    note,
    routine_off,
  }
}

/** UI 슬롯 라벨용 — 병원 등은 ‘기타’ 한 줄로 묶습니다 */
export const SCHEDULE_TYPE_PICKER_OPTIONS: { agentType: EventType | 'etc'; label: string }[] = [
  { agentType: 'school', label: '학교행사' },
  { agentType: 'holiday', label: '공휴일' },
  { agentType: 'vacation', label: '방학' },
  { agentType: 'travel', label: '여행' },
  { agentType: 'birthday', label: '생일' },
  { agentType: 'etc', label: '기타' },
]

export function agentTypeToPickerLabel(t: string): string {
  const key = t === 'hospital' ? 'etc' : t
  const row = SCHEDULE_TYPE_PICKER_OPTIONS.find((o) => o.agentType === (key as EventType))
  return row?.label ?? '기타'
}

/** 에이전트 타입 문자열 → 슬롯 한 줄(병원·기타 등은 `etc`) */
export function normalizeAgentTypeForPicker(t: string | undefined): EventType | 'etc' {
  const c = (t || 'etc').toLowerCase()
  if (c === 'hospital' || c === 'other') return 'etc'
  if (c === 'school' || c === 'holiday' || c === 'vacation' || c === 'travel' || c === 'birthday' || c === 'etc') {
    return c as EventType | 'etc'
  }
  return 'etc'
}

/** 슬롯에서 고른 유형 → 로컬 캘린더 eventType */
export function agentTypeToLocalCalendarType(t: string): LocalCalendarEvent['eventType'] {
  return agentParseTypeToLocalEventType(t === 'hospital' ? 'etc' : t)
}
