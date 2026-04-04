'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/parent/home',     label: '홈',   emoji: '🏠' },
  { href: '/parent/routine',  label: '루틴',  emoji: '📋' },
  { href: '/parent/approval', label: '승인',  emoji: '✅' },
] as const

export default function ParentNavBar() {
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
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-b-full bg-brand-blue" />
              )}
              <span className="text-xl leading-none">{emoji}</span>
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
