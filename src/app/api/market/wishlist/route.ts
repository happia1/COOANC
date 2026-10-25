import { NextResponse } from 'next/server'

// 미운영 기능: 이전 클라이언트의 요청도 DB·구매·게임 이벤트에 연결하지 않습니다.
export function GET() {
  return NextResponse.json({ error: '현재 사용하지 않는 기능이에요.' }, { status: 410 })
}

export const POST = GET
