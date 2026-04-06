'use client'

import { useEffect, useState } from 'react'
import type { AnimationsAtlasFile } from '@/lib/shopAnimationsAtlas'

/**
 * public/assets/img/items/shop/animations.json 을 불러옵니다.
 * animations.png 가 없으면 스프라이트는 깨져 보일 수 있어요.
 */
export function useShopAnimationsAtlas() {
  const [atlas, setAtlas] = useState<AnimationsAtlasFile | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/assets/img/items/shop/animations.json')
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
