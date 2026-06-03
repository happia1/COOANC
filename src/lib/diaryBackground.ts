/**
 * 다이어리 모달 배경 — 에셋 존재 여부를 한 번만 확인해 캐시합니다.
 * 파일이 없을 때 매번 404 를 기다리면 팝업이 빈 화면으로 오래 보일 수 있습니다.
 */

export const DIARY_BG_URL = '/assets/diary/diary_open.png'

let availabilityProbe: Promise<boolean> | null = null
let cachedAvailable: boolean | null = null

/** 브라우저에서 diary_open.png 로드 가능 여부 (결과 캐시) */
export function probeDiaryBackgroundAvailable(): Promise<boolean> {
  if (cachedAvailable !== null) return Promise.resolve(cachedAvailable)
  if (availabilityProbe) return availabilityProbe

  availabilityProbe = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      cachedAvailable = false
      resolve(false)
      return
    }
    const img = new window.Image()
    img.onload = () => {
      cachedAvailable = true
      resolve(true)
    }
    img.onerror = () => {
      cachedAvailable = false
      resolve(false)
    }
    img.src = DIARY_BG_URL
  })

  return availabilityProbe
}

export function isDiaryBackgroundCachedAvailable(): boolean | null {
  return cachedAvailable
}
