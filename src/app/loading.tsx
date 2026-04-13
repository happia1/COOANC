/**
 * Next.js App Router 가 라우트를 바꿀 때 잠깐 보여 주는 공용 로딩 UI입니다.
 * (서버에서 내려오는 래퍼이므로, 실제 애니메이션은 클라이언트 컴포넌트가 담당합니다.)
 */
import BunnyRunLoader from '@/components/ui/BunnyRunLoader'
import { ASSETS } from '@/constants/assets'

export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${ASSETS.layouts.sharedAppBackground})` }}
    >
      <BunnyRunLoader />
    </div>
  )
}
