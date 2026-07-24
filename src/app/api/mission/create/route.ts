import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/** Postgres 42703·PostgREST PGRST204 등 「스키마에 컬럼이 없다」류면 짧은 payload로 재시도 */
function isMissingColumnOrSchemaCacheError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42703' || err.code === 'PGRST204') return true
  const m = String(err.message ?? '')
  return m.includes('Could not find') && m.includes('schema cache')
}

/**
 * POST /api/mission/create
 * 부모가 새 미션 카드를 생성
 *
 * 삽입은 가능하면 service_role 로 수행합니다(RLS 정책 누락·원격 DB 불일치에도 동작).
 * SUPABASE_SERVICE_ROLE_KEY 가 없을 때만 세션 클라이언트로 insert(이때는 022/023 RLS 필요).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const {
    title,
    description,
    icon_emoji,
    credit_reward,
    heart_reward,
    exp_reward,
    difficulty,
    repeat_type,
    concept_tag,
    level_required,
    scheduled_time,
    block,
    linked_child_id,
  } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: '미션 이름을 입력해주세요' }, { status: 400 })
  }

  // scheduled_time 형식 검증 (HH:MM 또는 null)
  const parsedTime =
    typeof scheduled_time === 'string' && /^\d{2}:\d{2}$/.test(scheduled_time)
      ? scheduled_time
      : null

  // 부모 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 미션을 만들 수 있어요' }, { status: 403 })
  }

  /** 이 미션을 특정 자녀에게만 묶을 때(온보딩·루틴 탭). 없으면 전역 풀(null). */
  let parsedLinkedChildId: string | null = null
  if (linked_child_id != null && linked_child_id !== '') {
    const id = String(linked_child_id).trim()
    const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    if (!uuidOk) {
      return NextResponse.json({ error: '자녀 id 형식이 올바르지 않아요' }, { status: 400 })
    }
    const { data: link } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', id)
      .maybeSingle()
    if (!link) {
      return NextResponse.json({ error: '연결된 자녀에게만 미션을 묶을 수 있어요' }, { status: 403 })
    }
    parsedLinkedChildId = id
  }

  const validBlocks = ['morning', 'afternoon', 'evening', 'bedtime']
  const parsedBlock = typeof block === 'string' && validBlocks.includes(block) ? block : null

  const basePayload = {
    title: String(title).trim(),
    description: description ? String(description).trim() : null,
    icon_emoji: icon_emoji ? String(icon_emoji) : '⭐',
    credit_reward: Number(credit_reward) || 10,
    heart_reward: Number(heart_reward) || 0,
    exp_reward: Number(exp_reward) || 10,
    difficulty: difficulty ?? 'easy',
    repeat_type: repeat_type ?? 'daily',
    concept_tag: concept_tag ?? null,
    level_required: Number(level_required) || 0,
    is_active: true,
    block: parsedBlock,
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase

  // DB 마이그레이션 단계별 호환: 없는 컬럼(42703·PGRST204 등)이면 더 짧은 payload 로 재시도
  type InsertRow = Record<string, unknown>
  const attempts: InsertRow[] = []
  const seen = new Set<string>()
  const addAttempt = (row: InsertRow) => {
    const key = JSON.stringify(row)
    if (seen.has(key)) return
    seen.add(key)
    attempts.push(row)
  }
  if (parsedLinkedChildId) {
    addAttempt({ ...basePayload, scheduled_time: parsedTime, linked_child_id: parsedLinkedChildId })
  }
  addAttempt({ ...basePayload, scheduled_time: parsedTime })
  if (parsedLinkedChildId) {
    addAttempt({ ...basePayload, linked_child_id: parsedLinkedChildId })
  }
  addAttempt({ ...basePayload })

  let result = await db.from('missions').insert(attempts[0]).select().single()
  for (let a = 1; a < attempts.length && isMissingColumnOrSchemaCacheError(result.error); a++) {
    result = await db.from('missions').insert(attempts[a]).select().single()
  }

  if (result.error) {
    const rlsHint =
      result.error.message?.includes('row-level security') || result.error.code === '42501'
    console.error('[mission/create]', {
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      usedServiceRole: Boolean(service),
      hint: rlsHint
        ? 'RLS 차단 가능: .env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 또는 migrations 022/023 적용'
        : undefined,
    })
    return NextResponse.json({ error: '미션 생성에 실패했어요. 다시 시도해 주세요.' }, { status: 500 })
  }

  /** 자녀 전용으로 요청했는데 DB에 linked_child_id 가 없으면 재시도로 공용 행만 생길 수 있음 → 되돌리고 안내 */
  if (parsedLinkedChildId && result.data) {
    const created = result.data as { id: string; linked_child_id?: string | null }
    if (created.linked_child_id !== parsedLinkedChildId) {
      await db.from('missions').delete().eq('id', created.id)
      return NextResponse.json(
        {
          error:
            '자녀별 루틴 미션을 저장하려면 DB에 missions.linked_child_id 컬럼이 필요해요. Supabase SQL에 supabase/migrations/025_missions_linked_child_cascade.sql 을 적용한 뒤 다시 시도해 주세요.',
        },
        { status: 503 },
      )
    }
  }

  return NextResponse.json({ mission: result.data }, { status: 201 })
}
