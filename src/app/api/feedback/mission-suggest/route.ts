import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/feedback/mission-suggest
 * 설정의 「미션 추가 제안」에서 보낸 문구를 받습니다. (DB 없을 때는 로그만)
 */
export async function POST(req: NextRequest) {
  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length < 2) {
    return NextResponse.json({ error: '제안 내용을 조금 더 적어 주세요.' }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: '2000자 이내로 적어 주세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id ?? 'anonymous'

  console.info('[mission-suggest]', { userId: uid, length: text.length, preview: text.slice(0, 120) })

  return NextResponse.json({ ok: true })
}
