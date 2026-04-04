import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/mission/toggle
 * 미션 활성/비활성 토글 (부모 전용)
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let missionId: string, isActive: boolean
  try {
    ;({ missionId, isActive } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 미션을 수정할 수 있어요' }, { status: 403 })
  }

  const { error } = await supabase
    .from('missions')
    .update({ is_active: isActive })
    .eq('id', missionId)

  if (error) {
    return NextResponse.json({ error: '미션 수정에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ success: true, isActive })
}
