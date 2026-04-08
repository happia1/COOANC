import Image from 'next/image'
import Link from 'next/link'
import { AUTH_LOGO_SRC, TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_WIDTH } from '@/constants/branding'

type Props = {
  /**
   * 부모가 자녀 화면을 미리볼 때 true — 나가기는 쿠키를 지우는 API 로 연결합니다.
   * 자녀 본인 로그인이면 false 이고, 나가기는 부모 홈으로만 갑니다.
   */
  isParentPreview?: boolean
}

/**
 * 자녀 앱 공통 상단바
 * - 좌: COOANC 로고
 * - 우: 나가기(이미지 아이콘)
 */
export default function ChildTopBar({ isParentPreview = false }: Props) {
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
        <div className="flex items-center justify-end max-w-[min(100%,14rem)]">
          <Link
            href={exitHref}
            className="flex h-8 w-8 items-center justify-center shrink-0 transition-opacity hover:opacity-80"
            aria-label="나가기"
          >
            {/* 텍스트 버튼 대신 exit 아이콘 사용, 알약 배경 제거 */}
            <Image src="/assets/img/common/ui/exit.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </Link>
        </div>
      </div>
    </header>
  )
}
