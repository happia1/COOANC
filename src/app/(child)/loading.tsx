/**
 * 자녀 앱(`/home`, `/mission` …)으로 들어오거나 같은 그룹 안에서 페이지가 바뀔 때 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 부모가 자녀 프로필을 눌러 「자녀 화면 보기」로 넘어올 때도 이 화면이 잠시 뜰 수 있습니다.
 * - 루트(/) 첫 진입과 같은 토끼 달리기 애니메이션을 쓰고, 그 아래에 「지금 자녀 앱으로 바뀌는 중」이라는 문구를 보여 줍니다.
 * - 배경은 앱 공통 배경 이미지를 깔아 전환이 자연스럽게 보이게 합니다.
 */

import BunnyRunLoader from '@/components/ui/BunnyRunLoader'
import { ASSETS } from '@/constants/assets'

export default function ChildSegmentLoading() {
  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: `url(${ASSETS.layouts.sharedAppBackground})` }}
    >
      <BunnyRunLoader statusMessage="자녀 앱 화면으로 전환 중" />
    </div>
  )
}
