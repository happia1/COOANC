import Image from 'next/image'
import Link from 'next/link'
import { AUTH_LOGO_SRC, TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_WIDTH } from '@/constants/branding'

type Props = {
  childName: string
  /**
   * 부모가 자녀 화면을 미리볼 때 true — 나가기는 쿠키를 지우는 API 로 연결합니다.
   * 자녀 본인 로그인이면 false 이고, 나가기는 부모 홈으로만 갑니다.
   */
  isParentPreview?: boolean
}

/**
 * 자녀 앱 공통 상단바
 * - 좌: COOANC 로고
 * - 우: 자녀 이름 칩 + 나가기
 */
export default function ChildTopBar({ childName, isParentPreview = false }: Props) {
  const exitHref = isParentPreview ? '/api/parent/exit-child-ui' : '/parent/home'

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between max-w-md mx-auto px-4 py-3">
        <Image
          src={AUTH_LOGO_SRC}
          alt="COOANC"
          width={TOPBAR_LOGO_WIDTH}
          height={TOPBAR_LOGO_HEIGHT}
          className={TOPBAR_LOGO_CLASSNAME}
          priority
        />
        <div className="flex flex-wrap items-center justify-end gap-2 max-w-[min(100%,14rem)]">
          <span className="bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1.5 rounded-full truncate max-w-[9rem]">
            {childName}
          </span>
          <Link
            href={exitHref}
            className="bg-teal-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm active:scale-95 transition-all shrink-0"
          >
            나가기
          </Link>
        </div>
      </div>
    </header>
  )
}
