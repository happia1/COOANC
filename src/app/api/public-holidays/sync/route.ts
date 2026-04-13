import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, serviceRoleEnvMissingMessage } from '@/lib/supabase/admin'
import { fetchKasiHolidaysForYear, kasiItemsToPublicHolidayRows } from '@/lib/holidays'

/**
 * GET /api/public-holidays/sync?year=2026
 * - 천문연 특일 API 를 **해당 연도에 아직 동기화하지 않았을 때만** 호출합니다.
 * - 결과는 `public_holidays` 에 upsert 되고, `public_holiday_sync_log` 에 연도가 기록됩니다.
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

  if (rows.length > 0) {
    const payload = rows.map((r) => ({
      ...r,
      updated_at: nowIso,
    }))
    const { error: upErr } = await admin.from('public_holidays').upsert(payload, {
      onConflict: 'year,holiday_date',
    })
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    }
  }

  const { error: logErr } = await admin.from('public_holiday_sync_log').insert({
    year,
    row_count: rows.length,
    synced_at: nowIso,
  })
  if (logErr) {
    return NextResponse.json({ ok: false, error: logErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    year,
    upserted: rows.length,
  })
}
