'use client'

/**
 * 앱이 켜질 때 **올해(서울 기준)** 공휴일을 한 번 백그라운드로 동기화합니다.
 * 비개발자: Supabase `public_holidays` 에 이미 그 해 데이터가 있으면 **HTTP 요청 자체를 하지 않고**,
 * 없을 때만 `/api/public-holidays/sync` 를 한 번 호출해 서버가 특일 API 를 받아 저장하게 합니다.
 */

import { useEffect, useRef } from 'react'
import { getSeoulDateString } from '@/lib/koreaDate'
import { createClient } from '@/lib/supabase/client'

export function PublicHolidaysBootstrap() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const y = Number(getSeoulDateString().slice(0, 4))
    if (!Number.isFinite(y)) return

    const supabase = createClient()
    void (async () => {
      const { count, error } = await supabase
        .from('public_holidays')
        .select('id', { count: 'exact', head: true })
        .eq('year', y)

      /** RLS·네트워크 오류 시에는 서버 sync 가 같은 조건으로 막아 줄 수 있게 한 번 호출해 봅니다. */
      if (!error && count != null && count > 0) return

      void fetch(`/api/public-holidays/sync?year=${y}`, { method: 'GET' }).catch(() => {
        /* 동기화 실패는 앱 사용을 막지 않음 */
      })
    })()
  }, [])

  return null
}
