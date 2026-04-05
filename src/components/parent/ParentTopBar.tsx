import Image from 'next/image'
import Link from 'next/link'
import { AUTH_LOGO_SRC, TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_WIDTH } from '@/constants/branding'

type Props = { parentName: string }

/**
 * 부모 앱 공통 상단바
 * - 좌: COOANC 로고
 * - 우: 부모 이름 퍼플 칩 + 설정 버튼
 */
export default function ParentTopBar({ parentName }: Props) {
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
        <div className="flex items-center gap-2">
          <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {parentName}
          </span>
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <span className="text-base">⚙️</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
