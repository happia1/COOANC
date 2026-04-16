'use client'

import { useEffect, useState } from 'react'
import { SHOP_ANIMATIONS_SHEET_CACHE_KEY, type AnimationsAtlasFile } from '@/lib/shopAnimationsAtlas'

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
    fetch(`/assets/img/items/shop/animations.json?v=${SHOP_ANIMATIONS_SHEET_CACHE_KEY}`, {
      cache: 'force-cache',
    })
      .then((r) => {
        if (!r.ok) throw new Error('atlas json')
        return r.json() as Promise<AnimationsAtlasFile>
      })
      .then((data) => {
        if (!cancelled) setAtlas(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { atlas, failed }
}
