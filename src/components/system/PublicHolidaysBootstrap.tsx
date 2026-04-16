'use client'

/**
 * 앱이 켜질 때 **올해(서울 기준)** 공휴일을 한 번 백그라운드로 동기화합니다.
 * 비개발자: Supabase `public_holidays` 에 이미 그 해 데이터가 있으면 **HTTP 요청 자체를 하지 않고**,
 * 없을 때만 `/api/public-holidays/sync` 를 한 번 호출해 서버가 특일 API 를 받아 저장하게 합니다.
 *
 * - **sessionStorage**: 같은 탭에서 React Strict Mode 가 effect 를 두 번 돌려도
 *   이미 확인·동기화한 연도는 DB 조회·API 호출을 다시 하지 않습니다.
 */

import { useEffect } from 'react'
import { getSeoulDateString } from '@/lib/koreaDate'
import { createClient } from '@/lib/supabase/client'

/** 브라우저 세션(탭) 안에서 연도별로 「부트스트랩 완료」를 표시하는 키 접두사 */
const SESSION_DONE_PREFIX = 'cooanc_public_holidays_bootstrap_done_'

export function PublicHolidaysBootstrap() {
  useEffect(() => {
    const y = Number(getSeoulDateString().slice(0, 4))
    if (!Number.isFinite(y)) return

    const doneKey = `${SESSION_DONE_PREFIX}${y}`
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(doneKey) === '1') {
        return
      }
    } catch {
      /* 저장소 사용 불가 시에는 아래 Supabase·API 경로로 진행 */
    }

    const supabase = createClient()
    void (async () => {
      const { count, error } = await supabase
        .from('public_holidays')
        .select('id', { count: 'exact', head: true })
        .eq('year', y)

      /** 이미 해당 연도 행이 있으면 서버 sync URL 도 부르지 않고 종료 */
      if (!error && count != null && count > 0) {
        try {
          sessionStorage.setItem(doneKey, '1')
        } catch {
          /* noop */
        }
        return
      }

      /**
       * RLS·네트워크 오류 등으로 클라이언트 count 가 실패해도,
       * 서버 sync 라우트가 DB 를 다시 보고 외부 API 를 막을 수 있게 한 번 호출합니다.
       */
      try {
        const res = await fetch(`/api/public-holidays/sync?year=${y}`, { method: 'GET' })
        if (res.ok) {
          try {
            sessionStorage.setItem(doneKey, '1')
          } catch {
            /* noop */
          }
        }
      } catch {
        /* 동기화 실패는 앱 사용을 막지 않음 */
      }
    })()
  }, [])

  return null
}
