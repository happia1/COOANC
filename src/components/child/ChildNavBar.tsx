'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DockTabIcon, type DockTabIconId } from '@/components/navigation/DockTabIcons'

/**
 * 아이 앱 하단 독바 (60px 높이)
 * - 홈·미션·마켓 3탭만 두고, 부모 독바와 같은 SVG 아이콘을 사용합니다.
 */
const TABS: readonly { href: string; label: string; icon: DockTabIconId }[] = [
  { href: '/home', label: '홈', icon: 'home' },
  { href: '/mission', label: '미션', icon: 'smile' },
  { href: '/market', label: '마켓', icon: 'market' },
] as const

type Props = {
  /**
   * true: 부모가 「자녀 화면 보기」로 들어온 상태 — 탭 이동 시 브라우저 전체 네비게이션으로 쿠키를 확실히 실어 보냅니다.
   * false: 자녀 본인 로그인 — 일반 `Link` 로 빠른 클라이언트 전환 + prefetch 완화.
   */
  isParentPreview?: boolean
}

export default function ChildNavBar({ isParentPreview = false }: Props) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/90 shadow-lg backdrop-blur-sm">
      <div className="mx-auto flex h-[60px] max-w-md items-stretch">
        {TABS.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const tone = isActive ? 'text-slate-700' : 'text-slate-400'
          /** 부모 미리보기: `<a>` 로 전체 로드. 자녀 본인: `prefetch={false}` 로 탭 전환 시 불필요한 RSC 프리페치 감소 */
          if (isParentPreview) {
            return (
              <a
                key={href}
                href={href}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors no-underline text-inherit"
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-b-full bg-slate-700" />
                )}
                <DockTabIcon id={icon} className={`h-6 w-6 shrink-0 ${tone}`} />
                <span className={`text-[10px] font-bold leading-none ${tone}`}>{label}</span>
              </a>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-b-full bg-slate-700" />
              )}
              <DockTabIcon id={icon} className={`h-6 w-6 shrink-0 ${tone}`} />
              <span className={`text-[10px] font-bold leading-none ${tone}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
