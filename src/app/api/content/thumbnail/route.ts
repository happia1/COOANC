import { NextRequest, NextResponse } from 'next/server'
import { resolveContentChannelThumbnailUrl } from '@/lib/youtubeContent'

/**
 * GET /api/content/thumbnail?url=
 * - 클라이언트에서 플레이리스트·채널 썸네일을 추가로 조회할 때 사용합니다.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'url 이 필요해요' }, { status: 400 })
  }

  try {
    const thumbnailUrl = await resolveContentChannelThumbnailUrl(rawUrl)
    return NextResponse.json({ thumbnailUrl })
  } catch {
    return NextResponse.json({ error: '썸네일을 가져올 수 없어요' }, { status: 500 })
  }
}
