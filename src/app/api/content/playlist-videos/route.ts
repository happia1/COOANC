import { NextRequest, NextResponse } from 'next/server'
import { fetchYouTubeVideoList } from '@/lib/youtubeContent'

/**
 * GET /api/content/playlist-videos?url=
 * - 플레이리스트·채널 URL 에서 고를 수 있는 영상 목록을 반환합니다.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'url 이 필요해요' }, { status: 400 })
  }

  try {
    const videos = await fetchYouTubeVideoList(rawUrl, 50)
    return NextResponse.json({ videos })
  } catch {
    return NextResponse.json({ error: '영상 목록을 불러올 수 없어요' }, { status: 500 })
  }
}
