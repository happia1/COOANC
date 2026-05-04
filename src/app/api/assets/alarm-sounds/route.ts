import { NextResponse } from 'next/server'
import { ROUTINE_ALARM_SOUND_CATALOG } from '@/lib/routineAlarmSounds'

/** 구버전 JSON 이 캐시에 남지 않도록(옛 「폴더 스캔」목록 재사용 방지) */
export const dynamic = 'force-dynamic'

/**
 * GET /api/assets/alarm-sounds
 *
 * 알람 「소리 선택」팝업에 올 줄만 내립니다(고정 카탈로그).
 * 과거처럼 public 폴더를 훑어 목록을 늘리면 거짓말 안내음·연속 탭 거절음 같은
 * 다른 용도 파일까지 기타로 섞였기 때문에, 지금은 여기 카탈로그만 신뢰합니다.
 */
export async function GET() {
  const sounds = ROUTINE_ALARM_SOUND_CATALOG.map((s) => ({
    id: s.id,
    label: s.label,
    url: s.url,
    category: s.category,
  }))
  return NextResponse.json(
    { sounds },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    },
  )
}
