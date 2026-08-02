import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveContentAdminUser } from '@/lib/adminContentAccess'

/**
 * GET /api/admin/content-access
 * 로그인한 계정이 콘텐츠 운영자(`CONTENT_ADMIN_EMAILS`)인지 알려 줍니다.
 * 설정 화면에서 「기본 콘텐츠 라인업 관리」 진입 버튼을 보여 줄지 판단하는 데만 씁니다.
 * (허용 목록 자체는 서버 환경변수라 클라이언트에 내려보내지 않습니다.)
 */
export async function GET() {
  const supabase = await createClient()
  const auth = await resolveContentAdminUser(supabase)
  return NextResponse.json({ isAdmin: auth.ok === true })
}
