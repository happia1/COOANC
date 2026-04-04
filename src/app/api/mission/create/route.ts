import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/mission/create
 * 부모가 새 미션 카드를 생성
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

  const { title, description, icon_emoji, credit_reward, heart_reward, exp_reward, difficulty, repeat_type, concept_tag, level_required } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: '미션 이름을 입력해주세요' }, { status: 400 })
  }

  // 부모 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 미션을 만들 수 있어요' }, { status: 403 })
  }

  const { data: mission, error } = await supabase
    .from('missions')
    .insert({
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
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: '미션 생성에 실패했어요. 다시 시도해 주세요.' }, { status: 500 })
  }

  return NextResponse.json({ mission }, { status: 201 })
}
