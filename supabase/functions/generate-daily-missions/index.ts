/**
 * generate-daily-missions — Supabase Edge Function
 *
 * 실행: 매일 자정 cron (supabase/config.toml 설정 필요)
 * [functions.generate-daily-missions]
 * schedule = "0 0 * * *"
 *
 * ⚠️ Next 자녀 홈(`src/app/(child)/home/page.tsx`)과 완전히 같지 않습니다.
 * 여기서는 repeat_type(daily/weekly)·자녀 전용 템플릿 연결 등을 거치지 않고
 * 활성 미션 전부를 넣을 수 있습니다. 실제 카드 노출은 앱 쪽 템플릿 풀 필터가 최종입니다.
 *
 * 로직:
 * 1. 모든 family_links에서 활성 자녀 ID 조회
 * 2. 오늘 날짜 기준 calendar_events 조회
 * 3. routine_type 결정 (calendar_events → 요일 순)
 * 4. 해당 자녀 레벨 이하 is_active 미션 템플릿 조회
 * 5. daily_missions INSERT (이미 있으면 ON CONFLICT SKIP)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type RoutineType = 'weekday' | 'weekend' | 'holiday' | 'vacation'

interface CalendarEvent {
  parent_id: string
  child_id: string | null
  start_date: string
  end_date: string
  routine_override: 'weekend' | 'none' | 'weekday'
}

interface Mission {
  id: string
  is_active: boolean
  level_required: number
  scheduled_time: string | null
}

interface ChildStats {
  child_id: string
  current_level: number
}

interface FamilyLink {
  child_id: string
  parent_id: string
}

/** 앱 `getSeoulWeekdayShort` 과 같이 YYYY-MM-DD 를 한국 달력 요일로 해석 (UTC 자정 파싱 버그 방지) */
function weekdayIndexKstYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return 1
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const utcNoonKst = Date.UTC(y, mo - 1, d, 3, 0, 0)
  return new Date(utcNoonKst).getUTCDay()
}

function getRoutineType(today: string, events: CalendarEvent[], childId: string, parentId: string): RoutineType {
  const ev = events.find(e =>
    today >= e.start_date && today <= e.end_date &&
    e.parent_id === parentId &&
    (e.child_id === null || e.child_id === childId)
  )
  if (ev) {
    if (ev.routine_override === 'none') return 'holiday'
    if (ev.routine_override === 'weekday') return 'weekday'
    return 'vacation'
  }
  const dow = weekdayIndexKstYmd(today)
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  /** UTC `toISOString` 날짜는 한국 밤에 하루 어긋날 수 있음 — 앱은 Asia/Seoul 달력 사용 */
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  // 1. 모든 family_links 조회
  const { data: links, error: linksErr } = await supabase
    .from('family_links')
    .select('child_id, parent_id')

  if (linksErr || !links) {
    return new Response(JSON.stringify({ error: linksErr?.message }), { status: 500 })
  }

  const childIds  = [...new Set(links.map((l: FamilyLink) => l.child_id))]
  const parentIds = [...new Set(links.map((l: FamilyLink) => l.parent_id))]

  // 2. 오늘 날짜 calendar_events 조회
  const { data: calEvents } = await supabase
    .from('calendar_events')
    .select('parent_id, child_id, start_date, end_date, routine_override')
    .in('parent_id', parentIds)
    .lte('start_date', today)
    .gte('end_date', today)

  const events: CalendarEvent[] = calEvents ?? []

  // 3. 모든 child_stats (레벨 조회)
  const { data: allStats } = await supabase
    .from('child_stats')
    .select('child_id, current_level')
    .in('child_id', childIds)

  const statsMap = Object.fromEntries(
    ((allStats ?? []) as ChildStats[]).map(s => [s.child_id, s.current_level])
  )

  // 4. 모든 활성 미션 템플릿
  const { data: templates } = await supabase
    .from('missions')
    .select('id, is_active, level_required, scheduled_time')
    .eq('is_active', true)

  const allMissions: Mission[] = templates ?? []

  // 5. 자녀별 daily_missions 생성
  let inserted = 0
  let skipped  = 0

  for (const link of links as FamilyLink[]) {
    const { child_id, parent_id } = link
    const level = statsMap[child_id] ?? 0

    const routineType = getRoutineType(today, events, child_id, parent_id)
    if (routineType === 'holiday') { skipped++; continue }

    const eligibleMissions = allMissions.filter(m => m.level_required <= level)
    if (eligibleMissions.length === 0) continue

    const records = eligibleMissions.map(m => ({
      child_id,
      mission_template_id: m.id,
      date:                today,
      scheduled_time:      m.scheduled_time ?? null,
      routine_type:        routineType,
      is_completed:        false,
    }))

    // ON CONFLICT (child_id, mission_template_id, date) DO NOTHING
    const { error: insertErr } = await supabase
      .from('daily_missions')
      .upsert(records, { onConflict: 'child_id,mission_template_id,date', ignoreDuplicates: true })

    if (insertErr) {
      console.error(`[generate-daily-missions] child=${child_id}`, insertErr.message)
    } else {
      inserted += records.length
    }
  }

  return new Response(
    JSON.stringify({ ok: true, today, inserted, skipped, children: links.length }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
