import type { ReactNode } from 'react'

/**
 * 미션 탭 전용 레이아웃
 * - 부모 `main` 안에서 남는 세로 높이만 쓰고(`flex-1 min-h-0`).
 * - **가로·위쪽 풀 블리드**: `main` 의 `px-4`·`pt-4` 안쪽에만 자식이 들어가면 배경 PNG 가 양옆·상단에
 *   비치는 것처럼 보입니다. `w-[calc(100%+2rem)]` + `-mx-4` + `-mt-4` 로 패딩 폭만큼 박스를 넓히고
 *   당겨서, `MissionTab` 배경이 셸 가장자리까지 닿게 합니다(홈 `ChildHomeSceneryBand` 와 같은 원리).
 * - `overflow-x-hidden`: 탭 **전체**가 좌우로 밀리며 생기는 가로 스크롤·스크롤바를 막습니다.
 * - `overflow-y-hidden`: 세로는 **한 화면 안**에 가두어 `main` 전체 스크롤바가 생기지 않게 함.
 *   (`overflow-y-visible` 이면 flex 자식 `min-height:auto` 가 콘텐츠만큼 커져 뷰포트를 넘깁니다.)
 *   제목·하트는 `MissionTab` 안에서 `-mt` 를 최소로 두고, 카드만 안쪽 `overflow-y-auto`(스크롤바 숨김)로 처리합니다.
 */
export default function ChildMissionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mx-4 -mt-4 box-border flex min-h-0 min-w-0 w-[calc(100%+2rem)] max-w-none flex-1 shrink-0 flex-col self-stretch overflow-x-hidden overflow-y-hidden">
      {children}
    </div>
  )
}
