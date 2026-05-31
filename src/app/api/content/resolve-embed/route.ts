import { NextRequest, NextResponse } from 'next/server'
import { resolveYouTubeContentEmbedUrl } from '@/lib/youtubeContent'

/**
 * GET /api/content/resolve-embed?url=
 * - @채널 URL 등 동기 변환으로 embed 를 만들 수 없을 때 서버에서 첫 영상 id 를 찾습니다.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'url 이 필요해요' }, { status: 400 })
  }

  try {
    const embedUrl = await resolveYouTubeContentEmbedUrl(rawUrl)
    if (!embedUrl) {
      return NextResponse.json({ error: '앱 안에서 재생할 수 없는 주소예요' }, { status: 422 })
    }
    return NextResponse.json({ embedUrl })
  } catch {
    return NextResponse.json({ error: '재생 주소를 만들 수 없어요' }, { status: 500 })
  }
}
