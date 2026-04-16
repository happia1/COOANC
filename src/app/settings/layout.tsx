import type { ReactNode } from 'react'

/**
 * 설정 페이지 세그먼트 캐시
 * - 설정 화면 진입 시 RSC 요청 중복을 줄이기 위해 5분 재검증을 둡니다.
 */
export const revalidate = 300

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
