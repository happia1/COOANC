/**
 * 콘텐츠존 유튜브 URL → 썸네일·embed 변환
 * 비개발자: 주소에서 영상/플레이리스트 정보를 뽑아 썸네일·재생 화면 주소를 만듭니다.
 */

export const CONTENT_CHANNEL_DEFAULT_THUMBNAIL = '/assets/img/items/shop/items/movie_ticket.png'

const DEFAULT_THUMBNAIL = CONTENT_CHANNEL_DEFAULT_THUMBNAIL

const oEmbedCache = new Map<string, string>()
const playlistThumbCache = new Map<string, string>()
const channelVideoThumbCache = new Map<string, string>()
const channelVideoIdCache = new Map<string, string>()
const playlistVideosCache = new Map<string, YouTubeListVideo[]>()

export type YouTubeListVideo = {
  videoId: string
  title: string
}

const YOUTUBE_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; COOANC/1.0)',
  'Accept-Language': 'ko-KR,ko;q=0.9',
} as const

/** watch·youtu.be·embed URL 에서 video id 추출 */
export function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    if (u.hostname === 'youtu.be') {
      return u.pathname.replace(/^\//, '') || null
    }
    if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
    }
  } catch {
    return null
  }
  return null
}

/** playlist?list= 또는 watch?v=…&list= 에서 playlist id 추출 */
export function extractYouTubePlaylistId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const list = u.searchParams.get('list')
    if (list) return list
    if (u.pathname === '/playlist') return u.searchParams.get('list')
  } catch {
    return null
  }
  return null
}

/** video id 로 YouTube 썸네일 URL 생성 */
export function youtubeVideoThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/** 동기: URL 에 video id 가 있을 때만 썸네일 (없으면 null) */
export function syncYouTubeThumbnailFromUrl(playlistUrl: string): string | null {
  const videoId = extractYouTubeVideoId(playlistUrl)
  return videoId ? youtubeVideoThumbnailUrl(videoId) : null
}

/** @handle · /channel/ 형태의 유튜브 채널 URL 여부 */
export function isYouTubeChannelUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    return (
      u.hostname.endsWith('youtube.com') &&
      (u.pathname.includes('/@') || u.pathname.startsWith('/channel/'))
    )
  } catch {
    return false
  }
}

/** 채널 URL → /videos 탭 주소 (첫 영상 id 추출용) */
function normalizeYouTubeChannelVideosUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    if (!u.hostname.endsWith('youtube.com')) return null

    if (u.pathname.includes('/@')) {
      const base = u.pathname.replace(/\/videos\/?$/, '').replace(/\/+$/, '')
      return `${u.origin}${base}/videos`
    }

    if (u.pathname.startsWith('/channel/')) {
      const channelId = u.pathname.split('/')[2]
      if (!channelId) return null
      return `${u.origin}/channel/${channelId}/videos`
    }
  } catch {
    return null
  }
  return null
}

/**
 * @채널 /videos 페이지에서 첫 videoId 추출
 * (페파피그·호호샘 등 — 채널 URL 은 iframe embed 불가)
 */
export async function fetchYouTubeChannelFirstVideoId(rawUrl: string): Promise<string | null> {
  const videosUrl = normalizeYouTubeChannelVideosUrl(rawUrl)
  if (!videosUrl) return null

  const cached = channelVideoIdCache.get(videosUrl)
  if (cached) return cached

  try {
    const res = await fetch(videosUrl, {
      headers: YOUTUBE_FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null

    const html = await res.text()
    const videoId = /"videoId":"([a-zA-Z0-9_-]{11})"/.exec(html)?.[1]
    if (!videoId) return null

    channelVideoIdCache.set(videosUrl, videoId)
    return videoId
  } catch {
    return null
  }
}

/** 영상 id 로 콘텐츠존 iframe embed URL 생성 */
export function buildYouTubeVideoEmbedUrl(
  videoId: string,
  options?: { playlistId?: string | null; autoplay?: boolean; origin?: string },
): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
    autoplay: options?.autoplay === false ? '0' : '1',
  })
  if (options?.origin) params.set('origin', options.origin)
  if (options?.playlistId) params.set('list', options.playlistId)
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** 플레이리스트 RSS — 영상 목록 (제목·id) */
async function fetchYouTubePlaylistVideosFromRss(
  playlistId: string,
  limit: number,
): Promise<YouTubeListVideo[]> {
  const cacheKey = `${playlistId}:${limit}`
  const cached = playlistVideosCache.get(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
      { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } },
    )
    if (!res.ok) return []

    const xml = await res.text()
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    const videos: YouTubeListVideo[] = []

    for (const entry of entries) {
      if (videos.length >= limit) break
      const block = entry[1]
      const videoId =
        /<yt:videoId>([^<]+)<\/yt:videoId>/i.exec(block)?.[1]?.trim() ??
        /yt:video:([a-zA-Z0-9_-]{11})/i.exec(block)?.[1]?.trim()
      if (!videoId) continue
      const rawTitle = /<title>([^<]*)<\/title>/i.exec(block)?.[1]?.trim()
      videos.push({
        videoId,
        title: rawTitle ? decodeXmlText(rawTitle) : '영상',
      })
    }

    playlistVideosCache.set(cacheKey, videos)
    return videos
  } catch {
    return []
  }
}

function decodeYouTubeInlineText(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}

/** @채널 /videos HTML → 영상 목록 (YouTube 레이아웃 변경 대응) */
function parseYouTubeChannelVideosFromHtml(html: string, limit: number): YouTubeListVideo[] {
  const videos: YouTubeListVideo[] = []
  const seen = new Set<string>()

  const pushVideo = (videoId: string, title: string) => {
    if (!videoId || seen.has(videoId) || videos.length >= limit) return
    seen.add(videoId)
    videos.push({
      videoId,
      title: decodeYouTubeInlineText(title).trim() || '영상',
    })
  }

  // YouTube 최신: richItemRenderer → lockupViewModel (페파피그·호호샘 등)
  const lockupRe =
    /"lockupViewModel"\s*:\s*\{[\s\S]*?"title"\s*:\s*\{\s*"content"\s*:\s*"((?:\\.|[^"\\])*)"[\s\S]*?"contentId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g
  for (const match of html.matchAll(lockupRe)) {
    pushVideo(match[2], match[1])
  }
  if (videos.length > 0) return videos

  // 구형: gridVideoRenderer
  const gridRe =
    /"gridVideoRenderer"\s*:\s*\{[\s\S]*?"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"[\s\S]*?"title"\s*:\s*\{(?:\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}|\s*"simpleText"\s*:\s*"((?:\\.|[^"\\])*)")/g
  for (const match of html.matchAll(gridRe)) {
    pushVideo(match[1], match[2] ?? match[3] ?? '영상')
  }
  if (videos.length > 0) return videos

  // lockupViewModel — 제목 없이 contentId 만 있는 경우
  const contentIdRe =
    /"lockupViewModel"\s*:\s*\{[\s\S]*?"contentId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g
  let fallbackIndex = 0
  for (const match of html.matchAll(contentIdRe)) {
    fallbackIndex += 1
    pushVideo(match[1], `영상 ${fallbackIndex}`)
  }
  if (videos.length > 0) return videos

  const fallbackId = /"videoId":"([a-zA-Z0-9_-]{11})"/.exec(html)?.[1]
  if (fallbackId) {
    pushVideo(fallbackId, '영상 1')
  }

  return videos
}

/** @채널 /videos 페이지 — 영상 목록 (제목·id) */
async function fetchYouTubeChannelVideoList(
  rawUrl: string,
  limit: number,
): Promise<YouTubeListVideo[]> {
  const videosUrl = normalizeYouTubeChannelVideosUrl(rawUrl)
  if (!videosUrl) return []

  const cacheKey = `${videosUrl}:v2:${limit}`
  const cached = playlistVideosCache.get(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(videosUrl, {
      headers: YOUTUBE_FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []

    const html = await res.text()
    const videos = parseYouTubeChannelVideosFromHtml(html, limit)

    playlistVideosCache.set(cacheKey, videos)
    return videos
  } catch {
    return []
  }
}

/**
 * 채널·플레이리스트 URL → 선택 가능한 영상 목록
 * 비개발자: 이용권 사용 후 고를 수 있는 영상 리스트를 만듭니다.
 */
export async function fetchYouTubeVideoList(sourceUrl: string, limit = 24): Promise<YouTubeListVideo[]> {
  const playlistId = extractYouTubePlaylistId(sourceUrl)
  if (playlistId) {
    return fetchYouTubePlaylistVideosFromRss(playlistId, limit)
  }

  if (isYouTubeChannelUrl(sourceUrl)) {
    return fetchYouTubeChannelVideoList(sourceUrl, limit)
  }

  const videoId = extractYouTubeVideoId(sourceUrl)
  if (videoId) {
    return [{ videoId, title: '영상 1' }]
  }

  return []
}

/**
 * @채널 /videos 페이지에서 첫 videoId → hqdefault 썸네일
 * (oEmbed 는 @채널 URL 에 404 — 페파피그·호호샘 등)
 */
export async function fetchYouTubeChannelFirstVideoThumbnail(rawUrl: string): Promise<string | null> {
  const videoId = await fetchYouTubeChannelFirstVideoId(rawUrl)
  if (!videoId) return null

  const videosUrl = normalizeYouTubeChannelVideosUrl(rawUrl)
  const thumb = youtubeVideoThumbnailUrl(videoId)
  if (videosUrl) channelVideoThumbCache.set(videosUrl, thumb)
  return thumb
}

/** YouTube oEmbed 로 썸네일 조회 (플레이리스트·영상 — @채널은 404) */
export async function fetchYouTubeOEmbedThumbnail(rawUrl: string): Promise<string | null> {
  const cached = oEmbedCache.get(rawUrl)
  if (cached) return cached

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { thumbnail_url?: string }
    const thumb = typeof json.thumbnail_url === 'string' ? json.thumbnail_url.trim() : ''
    if (!thumb) return null
    oEmbedCache.set(rawUrl, thumb)
    return thumb
  } catch {
    return null
  }
}

/** 플레이리스트 RSS 첫 영상 id → 썸네일 (oEmbed 실패 시 폴백) */
export async function fetchPlaylistFirstVideoThumbnail(playlistId: string): Promise<string | null> {
  const cached = playlistThumbCache.get(playlistId)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
      { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } },
    )
    if (!res.ok) return null
    const xml = await res.text()
    const m =
      /<yt:videoId>([^<]+)<\/yt:videoId>/i.exec(xml) ??
      /<videoId>([^<]+)<\/videoId>/i.exec(xml)
    const videoId = m?.[1]?.trim()
    if (!videoId) return null
    const thumb = youtubeVideoThumbnailUrl(videoId)
    playlistThumbCache.set(playlistId, thumb)
    return thumb
  } catch {
    return null
  }
}

/**
 * 채널 URL → 썸네일 (비동기, oEmbed·RSS 폴백 포함)
 * 비개발자: 주소만으로도 유튜브에서 대표 그림을 가져옵니다.
 */
export async function resolveContentChannelThumbnailUrl(
  playlistUrl: string,
  storedThumbnailUrl?: string | null,
): Promise<string> {
  if (storedThumbnailUrl?.trim()) return storedThumbnailUrl.trim()

  const syncThumb = syncYouTubeThumbnailFromUrl(playlistUrl)
  if (syncThumb) return syncThumb

  if (isYouTubeChannelUrl(playlistUrl)) {
    const channelThumb = await fetchYouTubeChannelFirstVideoThumbnail(playlistUrl)
    if (channelThumb) return channelThumb
  }

  const oembedThumb = await fetchYouTubeOEmbedThumbnail(playlistUrl)
  if (oembedThumb) return oembedThumb

  const playlistId = extractYouTubePlaylistId(playlistUrl)
  if (playlistId) {
    const rssThumb = await fetchPlaylistFirstVideoThumbnail(playlistId)
    if (rssThumb) return rssThumb
  }

  return DEFAULT_THUMBNAIL
}

/** 플레이리스트·영상 URL → hqdefault 썸네일 (동기, 클라이언트 즉시 표시용) */
export function contentChannelThumbnailUrl(playlistUrl: string, storedThumbnailUrl?: string | null): string {
  if (storedThumbnailUrl?.trim()) return storedThumbnailUrl.trim()
  const syncThumb = syncYouTubeThumbnailFromUrl(playlistUrl)
  if (syncThumb) return syncThumb
  return DEFAULT_THUMBNAIL
}

/**
 * 콘텐츠 시청용 iframe embed URL
 * - 플레이리스트: videoseries
 * - 영상+리스트: 해당 영상 + list 파라미터
 * - 채널(@handle): embed 불가 시 null
 */
export function toYouTubeContentEmbedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const playlistId = extractYouTubePlaylistId(rawUrl)
    const videoId = extractYouTubeVideoId(rawUrl)

    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
      autoplay: '1',
    })

    if (videoId && playlistId) {
      params.set('list', playlistId)
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
    }

    if (playlistId) {
      params.set('list', playlistId)
      return `https://www.youtube.com/embed/videoseries?${params.toString()}`
    }

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
    }

    // 채널·@handle 페이지는 iframe embed 가 제한될 수 있음 — 시도용
    if (u.hostname.endsWith('youtube.com') && (u.pathname.includes('/@') || u.pathname.includes('/channel/'))) {
      return null
    }
  } catch {
    return null
  }
  return null
}

/**
 * 콘텐츠 시청용 iframe embed URL (비동기)
 * - 플레이리스트·영상: 즉시 변환
 * - @채널: /videos 첫 영상 id 로 embed (페파피그·호호샘 등)
 */
export async function resolveYouTubeContentEmbedUrl(rawUrl: string): Promise<string | null> {
  const sync = toYouTubeContentEmbedUrl(rawUrl)
  if (sync) return sync

  if (isYouTubeChannelUrl(rawUrl)) {
    const videoId = await fetchYouTubeChannelFirstVideoId(rawUrl)
    if (videoId) return buildYouTubeVideoEmbedUrl(videoId)
  }

  return null
}

/** MM:SS 형식으로 남은 초 표시 */
export function formatRemainingMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** started_at + duration_minutes 기준 남은 초 (Date.now 사용 — 백그라운드 탭 복귀 시에도 정확) */
export function remainingContentSeconds(
  startedAtIso: string,
  durationMinutes: number,
  nowMs: number = Date.now(),
): number {
  const endMs = new Date(startedAtIso).getTime() + durationMinutes * 60 * 1000
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000))
}
