'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/home', label: '홈' },
  { href: '/mission', label: '미션' },
  { href: '/market', label: '마켓' },
  { href: '/sticker', label: '스티커' },
  { href: '/settings', label: '설정' },
] as const

/**
 * 아이 앱 하단 내비게이션 바 (높이 60px)
 * - 활성 탭: brand-blue + 상단 인디케이터
 */
export default function ChildNavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/90 shadow-lg backdrop-blur-sm">
      <div className="mx-auto flex h-[60px] max-w-md items-stretch">
        {TABS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-b-full bg-brand-blue" />
              )}
              <span
                className={`text-[11px] font-bold leading-none ${
                  isActive ? 'text-brand-blue' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
