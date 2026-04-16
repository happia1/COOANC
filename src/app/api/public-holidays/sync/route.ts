import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, serviceRoleEnvMissingMessage } from '@/lib/supabase/admin'
import { fetchKasiHolidaysForYear, kasiItemsToPublicHolidayRows } from '@/lib/holidays'

/**
 * GET /api/public-holidays/sync?year=2026
 * - `public_holidays` 에 해당 연도 행이 이미 있으면 특일 API 를 호출하지 않습니다.
 * - 없을 때만 천문연 API를 받아 RPC `replace_public_holidays_for_year` 로 저장하고 `public_holiday_sync_log` 에 기록합니다.
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

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: serviceRoleEnvMissingMessage() }, { status: 503 })
  }

  /**
   * `public_holidays` 에 해당 연도 행이 이미 있으면 특일 API 를 호출하지 않습니다.
   * (sync_log 만 있고 데이터가 비어 있는 예외는 다시 받을 수 있게 log 단독으로는 스킵하지 않습니다.)
   */
  const { count: existingRows, error: countErr } = await admin
    .from('public_holidays')
    .select('*', { count: 'exact', head: true })
    .eq('year', year)

  if (!countErr && existingRows != null && existingRows > 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      year,
      message: 'public_holidays에 이미 해당 연도 데이터가 있습니다',
    })
  }

  const serviceKey = process.env.NEXT_PUBLIC_HOLIDAY_API_KEY?.trim()
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_HOLIDAY_API_KEY 가 설정되지 않았습니다' },
      { status: 503 },
    )
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
