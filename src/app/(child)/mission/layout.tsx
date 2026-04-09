import type { ReactNode } from 'react'

/**
 * 미션 탭 전용 레이아웃
 * - 부모 `main` 안에서 남는 세로 높이만 쓰고(`flex-1 min-h-0`).
 * - `overflow-x-hidden`: 탭 **전체**가 좌우로 밀리며 생기는 가로 스크롤·스크롤바를 막습니다.
 *   (미션 카드 줄만 가로 스크롤 — `MissionTab` 안 `overflow-x-auto` 한 겹에서 처리)
 * - `overflow-y-hidden`: 세로는 `MissionTab` 내부 스크롤 영역이 담당합니다.
 */
export default function ChildMissionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">{children}</div>
  )
}
