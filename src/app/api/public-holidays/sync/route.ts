import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, serviceRoleEnvMissingMessage } from '@/lib/supabase/admin'
import { fetchKasiHolidaysForYear, kasiItemsToPublicHolidayRows } from '@/lib/holidays'

/**
 * GET /api/public-holidays/sync?year=2026
 * - 천문연 특일 API 를 **해당 연도에 아직 동기화하지 않았을 때만** 호출합니다.
 * - 결과는 RPC `replace_public_holidays_for_year` 로 `public_holidays` 를 갈아끼운 뒤, `public_holiday_sync_log` 에 기록합니다.
 * - 인증키: `NEXT_PUBLIC_HOLIDAY_API_KEY` (서버에서만 읽음 — 클라이언트 번들에 넣지 마세요)
 */

function parseYear(raw: string | null): number | null {
  if (!raw) return null
  const y = Number(raw)
  if (!Number.isInteger(y) || y < 1990 || y > 2100) return null
  return y
}

export async function GET(req: NextRequest) {
  const year = parseYear(req.nextUrl.searchParams.get('year'))
  if (year == null) {
    return NextResponse.json({ error: 'year 파라미터(1990~2100)가 필요합니다' }, { status: 400 })
  }

  const serviceKey = process.env.NEXT_PUBLIC_HOLIDAY_API_KEY?.trim()
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_HOLIDAY_API_KEY 가 설정되지 않았습니다' },
      { status: 503 },
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: serviceRoleEnvMissingMessage() }, { status: 503 })
  }

  const { data: already } = await admin
    .from('public_holiday_sync_log')
    .select('year')
    .eq('year', year)
    .maybeSingle()

  if (already?.year === year) {
    return NextResponse.json({ ok: true, skipped: true, year, message: '이미 동기화된 연도입니다' })
  }

  const { items, headerCode, headerMsg } = await fetchKasiHolidaysForYear(serviceKey, year, {
    numOfRows: 50,
  })
  if (process.env.NODE_ENV === 'development') {
    console.log('[public-holidays/sync] API 응답', {
      year,
      headerCode,
      headerMsg,
      itemCount: items.length,
      sample: items.slice(0, 5).map((it) => ({
        locdate: it.locdate,
        dateName: it.dateName,
        isHoliday: it.isHoliday,
      })),
    })
  }
  if (headerCode !== '00') {
    return NextResponse.json(
      { ok: false, year, headerCode, headerMsg },
      { status: 502 },
    )
  }

  const rows = kasiItemsToPublicHolidayRows(year, items)
  const nowIso = new Date().toISOString()

  /**
   * `public_holidays`(id, date, name, year, created_at) — 컬럼 `date` 예약어·PostgREST bulk insert 이슈를 피하려
   * Supabase RPC `replace_public_holidays_for_year`(058 마이그레이션)로 연도 단위 DELETE 후 INSERT 합니다.
   */
  console.log('[public-holidays/sync] DB 반영 직전', {
    year,
    rowCount: rows.length,
    sample: rows.slice(0, 3),
  })

  const { error: rpcErr } = await admin.rpc('replace_public_holidays_for_year', {
    p_year: year,
    p_rows: rows,
  })
  if (rpcErr) {
    console.error('[public-holidays/sync] Supabase RPC replace_public_holidays_for_year', {
      message: rpcErr.message,
      code: rpcErr.code,
      details: rpcErr.details,
      hint: rpcErr.hint,
    })
    return NextResponse.json(
      {
        ok: false,
        error: rpcErr.message,
        hint: 'Supabase에 마이그레이션 058_replace_public_holidays_for_year.sql 적용 여부를 확인하세요.',
      },
      { status: 500 },
    )
  }

  const { error: logErr } = await admin.from('public_holiday_sync_log').insert({
    year,
    row_count: rows.length,
    synced_at: nowIso,
  })
  if (logErr) {
    console.error('[public-holidays/sync] Supabase insert(public_holiday_sync_log)', {
      message: logErr.message,
      code: logErr.code,
      details: logErr.details,
      hint: logErr.hint,
    })
    return NextResponse.json({ ok: false, error: logErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    year,
    upserted: rows.length,
  })
}
