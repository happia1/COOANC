'use client'

/**
 * 주소에 `?settings=open` 이 붙었을 때 설정 시트를 자동으로 엽니다.
 * - `/settings` 에서 부모 계정은 `/parent/home?settings=open` 으로 리다이렉트된 뒤 이 컴포넌트가 처리합니다.
 * - useSearchParams 는 Suspense 경계 안에서만 쓰기 위해 파일을 분리했습니다.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  onOpenSettings: () => void
}

export default function ParentSettingsDeepLink({ onOpenSettings }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  /** 같은 쿼리로 연속 트리거되는 것만 막고, 쿼리가 사라졌다 다시 오면 다시 열 수 있게 초기화합니다 */
  const openedForQueryRef = useRef(false)

  useEffect(() => {
    if (searchParams.get('settings') !== 'open') {
      openedForQueryRef.current = false
      return
    }
    if (openedForQueryRef.current) return
    openedForQueryRef.current = true
    onOpenSettings()
    router.replace(pathname, { scroll: false })
  }, [searchParams, pathname, router, onOpenSettings])

  return null
}
