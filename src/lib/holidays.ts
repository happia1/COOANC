/**
 * 공공데이터포털 — 한국천문연구원 특일 정보 API(getHoliDeInfo)
 * 비개발자: 정부에서 제공하는 "올해 공휴일이 언제인지" JSON 을 가져와서 우리 DB 에 넣기 전에 가공합니다.
 *
 * API 문서: https://www.data.go.kr (SpcdeInfoService / getHoliDeInfo)
 * 인증키는 환경 변수 `NEXT_PUBLIC_HOLIDAY_API_KEY` 에만 두고, 서버(API 라우트)에서 읽습니다.
 */

/** API 한 건에서 우리가 쓰는 필드만 골라 담은 형태입니다 */
export type KasiHolidayApiItem = {
  /** 원본 locdate — 숫자 20260101 또는 문자열 */
  locdate: number | string
  /** 공휴일·절기 등 이름 */
  dateName: string
  /** 실제 쉬는 날이면 Y, 아니면 N */
  isHoliday: string
}

const HOLI_DE_INFO_URL =
  'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo'

/** locdate(8자리) → YYYY-MM-DD (파싱 실패 시 null) */
export function locdateToIsoDate(locdate: number | string | null | undefined): string | null {
  if (locdate == null) return null
  const digits = String(locdate).replace(/\D/g, '')
  if (digits.length !== 8) return null
  const y = digits.slice(0, 4)
  const m = digits.slice(4, 6)
  const d = digits.slice(6, 8)
  return `${y}-${m}-${d}`
}

function extractItemArray(payload: unknown): unknown[] {
  const body = (payload as { response?: { body?: { items?: { item?: unknown } } } })?.response?.body
  const raw = body?.items?.item
  if (Array.isArray(raw)) return raw
  if (raw != null && typeof raw === 'object') return [raw]
  return []
}

function normalizeItem(row: unknown): KasiHolidayApiItem | null {
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  const locdate = o.locdate as number | string | undefined
  const dateName = String(o.dateName ?? o.datename ?? '').trim()
  const isHoliday = String(o.isHoliday ?? o.isholiday ?? 'N')
    .trim()
    .toUpperCase()
  if (locdate == null || !dateName) return null
  return { locdate, dateName, isHoliday: isHoliday === 'Y' ? 'Y' : 'N' }
}

/**
 * 천문연 특일 API 를 호출해 한 연도 분의 항목을 가져옵니다.
 * - `serviceKey` 는 이미 인코딩된 키가 올 수 있어 `encodeURIComponent` 한 번만 적용합니다.
 * - `totalCount` 가 `numOfRows` 보다 크면 `pageNo` 를 올려 다음 페이지를 이어 받습니다.
 */
export async function fetchKasiHolidaysForYear(
  serviceKey: string,
  solYear: number,
  options?: { numOfRows?: number },
): Promise<{ items: KasiHolidayApiItem[]; headerCode: string; headerMsg: string }> {
  const numOfRows = options?.numOfRows ?? 50
  const key = serviceKey.trim()
  if (!key) {
    return { items: [], headerCode: 'NO_KEY', headerMsg: 'HOLIDAY_API_KEY 비어 있음' }
  }

  const all: KasiHolidayApiItem[] = []
  let pageNo = 1
  let headerCode = ''
  let headerMsg = ''
  let totalCount = 0

  for (let guard = 0; guard < 20; guard += 1) {
    const qs = new URLSearchParams({
      solYear: String(solYear),
      numOfRows: String(numOfRows),
      pageNo: String(pageNo),
      _type: 'json',
    })
    const url = `${HOLI_DE_INFO_URL}?${qs.toString()}&serviceKey=${encodeURIComponent(key)}`

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text) as unknown
    } catch {
      return {
        items: [],
        headerCode: 'JSON_ERROR',
        headerMsg: text.slice(0, 200),
      }
    }

    const header = (json as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response
      ?.header
    headerCode = String(header?.resultCode ?? '')
    headerMsg = String(header?.resultMsg ?? '')
    if (headerCode && headerCode !== '00') {
      return { items: [], headerCode, headerMsg }
    }

    const body = (json as { response?: { body?: { totalCount?: number | string } } })?.response?.body
    totalCount = Number(body?.totalCount ?? 0)

    const pageItems: KasiHolidayApiItem[] = []
    for (const row of extractItemArray(json)) {
      const n = normalizeItem(row)
      if (n) {
        all.push(n)
        pageItems.push(n)
      }
    }

    // 개발 시 터미널·브라우저 콘솔에서 API 응답이 도착했는지 확인하기 위한 로그입니다.
    if (process.env.NODE_ENV === 'development') {
      const sample = pageItems.slice(0, 5).map((it) => ({
        locdate: it.locdate,
        dateName: it.dateName,
        isHoliday: it.isHoliday,
      }))
      console.log('[fetchKasiHolidaysForYear]', {
        solYear,
        pageNo,
        httpOk: res.ok,
        headerCode,
        headerMsg,
        totalCount,
        pageItemCount: pageItems.length,
        cumulative: all.length,
        sample,
      })
    }

    if (totalCount <= 0 || pageNo * numOfRows >= totalCount) break
    pageNo += 1
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[fetchKasiHolidaysForYear] done', { solYear, totalItems: all.length })
  }

  return { items: all, headerCode: headerCode || '00', headerMsg }
}

/** API 행 → Supabase upsert 용 레코드(연도·날짜·이름·Y/N) */
export function kasiItemsToPublicHolidayRows(
  solYear: number,
  items: KasiHolidayApiItem[],
): { year: number; holiday_date: string; name: string; is_holiday: 'Y' | 'N' }[] {
  const out: { year: number; holiday_date: string; name: string; is_holiday: 'Y' | 'N' }[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const ymd = locdateToIsoDate(it.locdate)
    if (!ymd) continue
    const dedupKey = `${solYear}:${ymd}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    const flag: 'Y' | 'N' = it.isHoliday === 'Y' ? 'Y' : 'N'
    out.push({
      year: solYear,
      holiday_date: ymd,
      name: it.dateName,
      is_holiday: flag,
    })
  }
  return out
}
