'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/home',     label: '홈',    emoji: '🏠' },
  { href: '/mission',  label: '미션',  emoji: '⭐' },
  { href: '/market',   label: '마켓',  emoji: '🛒' },
  { href: '/sticker',  label: '스티커', emoji: '🎀' },
  { href: '/settings', label: '설정',  emoji: '⚙️' },
] as const

/**
 * 아이 앱 하단 내비게이션 바 (높이 60px)
 * - 활성 탭: brand-blue 컬러 + 상단 인디케이터 점
 * - 비활성 탭: gray-400
 */
export default function ChildNavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-t border-gray-100 shadow-lg">
      <div className="flex items-stretch max-w-md mx-auto h-[60px]">
        {TABS.map(({ href, label, emoji }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors"
            >
              {/* 활성 인디케이터 */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-b-full bg-brand-blue" />
              )}
              <span className="text-xl leading-none">{emoji}</span>
              <span
                className={`text-[10px] font-bold leading-none ${
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
