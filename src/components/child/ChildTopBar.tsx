import Image from 'next/image'
import Link from 'next/link'
import { AUTH_LOGO_SRC } from '@/constants/branding'

type Props = { childName: string }

/**
 * 자녀 앱 공통 상단바
 * - 좌: COOANC 로고
 * - 우: 자녀 이름 teal 칩 + 나가기 버튼 (teal pill)
 */
export default function ChildTopBar({ childName }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between max-w-md mx-auto px-4 py-3">
        <Image
          src={AUTH_LOGO_SRC}
          alt="COOANC"
          width={360}
          height={120}
          className="h-[108px] w-auto max-w-[min(100%,360px)] object-contain"
          priority
        />
        <div className="flex items-center gap-2">
          <span className="bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {childName}
          </span>
          <Link
            href="/parent/home"
            className="bg-teal-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm active:scale-95 transition-all"
          >
            나가기
          </Link>
        </div>
      </div>
    </header>
  )
}
