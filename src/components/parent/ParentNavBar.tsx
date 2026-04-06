'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 컬러 이모지 대신 짧은 텍스트 기호만 사용(집 · 스마일 · 체크 느낌)
const TABS = [
  { href: '/parent/home', label: '홈', symbol: '집' },
  { href: '/parent/routine', label: '루틴', symbol: ':)' },
  { href: '/parent/approval', label: '승인', symbol: '✓' },
] as const

export default function ParentNavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-t border-gray-100 shadow-lg">
      <div className="flex items-stretch max-w-md mx-auto h-[60px]">
        {TABS.map(({ href, label, symbol }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors"
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-b-full bg-brand-blue" />
              )}
              <span
                className={`text-sm font-black leading-none tabular-nums ${isActive ? 'text-gray-800' : 'text-gray-400'}`}
                aria-hidden
              >
                {symbol}
              </span>
              <span className={`text-[10px] font-bold leading-none ${isActive ? 'text-brand-blue' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
