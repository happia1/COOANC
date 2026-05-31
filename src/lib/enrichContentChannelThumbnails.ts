import type { ContentChannel } from '@/types/database'
import {
  CONTENT_CHANNEL_DEFAULT_THUMBNAIL,
  resolveContentChannelThumbnailUrl,
} from '@/lib/youtubeContent'

/** 채널 목록에 썸네일 URL을 채웁니다 (병렬) */
export async function enrichContentChannelsWithThumbnails(
  channels: ContentChannel[],
): Promise<ContentChannel[]> {
  return Promise.all(
    channels.map(async (ch) => {
      const thumb = await resolveContentChannelThumbnailUrl(ch.playlist_url, ch.thumbnail_url)
      if (thumb === CONTENT_CHANNEL_DEFAULT_THUMBNAIL) return ch
      return { ...ch, thumbnail_url: thumb }
    }),
  )
}
