'use client'

/**
 * `app/layout.tsx` 는 **서버 컴포넌트**라서 `next/dynamic` 에 `ssr: false` 를 직접 쓸 수 없습니다.
 * (Next 16 빌드: "`ssr: false` is not allowed with `next/dynamic` in Server Components")
 *
 * 비개발자 설명:
 * - 공휴일 동기화 UI는 없고, 브라우저에서만 조용히 돌아가는 코드입니다.
 * - 그래도 서버가 HTML 을 만들 때는 굳이 불러오지 않고, 사용자 기기에서만 나중에 불러오게
 *   작은 「클라이언트 전용 껍데기」 파일을 하나 두었습니다.
 */

import dynamic from 'next/dynamic'

/** 서버 레이아웃에는 이 컴포넌트만 넣고, 실제 로직은 별도 청크로 지연 로드합니다. */
export const PublicHolidaysBootstrapLazy = dynamic(
  () =>
    import('@/components/system/PublicHolidaysBootstrap').then((mod) => ({
      default: mod.PublicHolidaysBootstrap,
    })),
  { ssr: false, loading: () => null },
)
