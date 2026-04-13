'use client'

/**
 * 앱이 켜질 때 **올해(서울 기준)** 공휴일을 한 번 백그라운드로 동기화합니다.
 * 비개발자: 이미 받아 둔 해는 서버가 건너뛰어서 API 를 남발하지 않습니다.
 */

import { useEffect, useRef } from 'react'
import { getSeoulDateString } from '@/lib/koreaDate'

export function PublicHolidaysBootstrap() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const y = Number(getSeoulDateString().slice(0, 4))
    if (!Number.isFinite(y)) return

    void fetch(`/api/public-holidays/sync?year=${y}`, { method: 'GET' }).catch(() => {
      /* 동기화 실패는 앱 사용을 막지 않음 */
    })
  }, [])

  return null
}
