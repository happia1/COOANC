'use client'

import { useEffect, useState } from 'react'
import { SHOP_ANIMATIONS_SHEET_CACHE_KEY, type AnimationsAtlasFile } from '@/lib/shopAnimationsAtlas'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'

/**
 * public/assets/img/items/shop/animations.json 을 불러옵니다.
 * animations.png 가 없으면 스프라이트는 깨져 보일 수 있어요.
 */
export function useShopAnimationsAtlas() {
  const [atlas, setAtlas] = useState<AnimationsAtlasFile | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    /** JSON 도 같은 쿼리로 묶어 두면 배포·캐시 이슈 추적이 쉽습니다 */
    void (async () => {
      /** 정적 파일 대신 SPA HTML 이 오면 .json() 이 "<!DOCTYPE" 파싱 오류를 냅니다 */
      try {
        const r = await fetch(
          `/assets/img/items/shop/animations.json?v=${SHOP_ANIMATIONS_SHEET_CACHE_KEY}`,
          { cache: 'force-cache' },
        )
        if (!r.ok) throw new Error('atlas json')
        const { data, parseError } = await parseJsonFromResponse<AnimationsAtlasFile>(r)
        if (parseError || !data) throw new Error('atlas 비JSON')
        if (!cancelled) setAtlas(data)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { atlas, failed }
}
