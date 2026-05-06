import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * 브라우저 GoTrue 저장소(Web Lock)를 쓰지 않고 "이미 세션이 있는지"만 확인합니다.
 * 로그인 페이지 자동 이동처럼 `getSession()` 만 필요할 때 라우터에서 검사하면 띅 충돌을 피합니다.
 *
 * 비개발자: **쿠키에 든 로그인 쿠키**를 서버가 읽어서 「로그인됨 여부」만 돌려줍니다.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    if (error) {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }
    return NextResponse.json({ authenticated: Boolean(session) }, { status: 200 })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
