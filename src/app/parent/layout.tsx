/**
 * `/parent` 이하 모든 화면을 감싸는 레이아웃입니다.
 *
 * 비개발자 설명:
 * - 부모 앱은 주소가 `/parent/home`, `/parent/routine` 처럼 `/parent` 로 시작합니다.
 * - 여기서는 「구매 승인 대기 몇 건인지」를 한 번만 조회해, 상단 종·알람에 쓰도록 넘깁니다.
 * - 실제 상단·하단 바를 그리는 일은 `ParentAppChrome` 이 담당합니다(주소가 `/parent` 일 때는 바를 숨깁니다).
 */
import type { ReactNode } from 'react'
import ParentAppChrome from '@/components/parent/ParentAppChrome'

export default async function ParentLayout({ children }: { children: ReactNode }) {
  /**
   * 구매 승인 대기 건수는 클라이언트(`ParentRoutineAlarmButton`)에서 갱신합니다.
   * 레이아웃에서 DB 를 한 번 더 기다리면 Supabase 가 느릴 때 첫 화면이 더 오래 막힙니다.
   */
  const pendingApprovalCount = 0

  return <ParentAppChrome pendingApprovalCount={pendingApprovalCount}>{children}</ParentAppChrome>
}
