/** YouTube IFrame Player API — 최소 타입 */

export type YouTubePlayerInstance = {
  destroy: () => void
  pauseVideo: () => void
  playVideo: () => void
}

type YouTubePlayerCtor = new (
  element: HTMLElement | string,
  options: {
    videoId?: string
    playerVars?: Record<string, string | number>
    events?: {
      onStateChange?: (event: { data: number }) => void
      onError?: (event: { data: number }) => void
    }
  },
) => YouTubePlayerInstance

type YouTubeNamespace = {
  Player: YouTubePlayerCtor
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let loadPromise: Promise<YouTubeNamespace> | null = null

/** iframe API 스크립트 1회 로드 */
export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('browser only'))
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      const finish = () => {
        if (window.YT?.Player) resolve(window.YT)
        else reject(new Error('YouTube API unavailable'))
      }
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        finish()
      }
      if (existing) {
        window.setTimeout(finish, 50)
        return
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      tag.onerror = () => reject(new Error('YouTube API load failed'))
      document.head.appendChild(tag)
    })
  }
  return loadPromise
}

export function getYouTubeOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}
