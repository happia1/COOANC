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
    // `usePathname()` 을 의존성에 넣으면 개발(HMR) 환경에서 의존성 배열 길이 경고가 난 사례가 있어,
    // 최초 마운트 시점의 경로만 `window.location` 으로 읽습니다.
    // - 첫 화면이 `/login`·`/signup` 이면 공휴일 동기화를 건너뜁니다(GoTrue Lock 과 겹치기 쉬움).
    // - 로그인 후에는 `window.location.href = '/'` 등 **전체 새로고침**이면 이 컴포넌트가 다시 마운트되어
    //   그때 경로가 바뀐 뒤 동기화가 실행됩니다. (같은 레이아웃만의 소프트 네비게이션만으로는 재실행 안 될 수 있음)
    if (typeof window === 'undefined') return
    const p = window.location.pathname
    if (p === '/login' || p.startsWith('/signup')) return

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
    // 의존성 배열은 항상 비어 있어야 합니다(크기가 바뀌면 React 가 경고를 냅니다).
  }, [])

  return null
}
