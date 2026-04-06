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

export default function ChildNavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/90 shadow-lg backdrop-blur-sm">
      <div className="mx-auto flex h-[60px] max-w-md items-stretch">
        {TABS.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const tone = isActive ? 'text-slate-700' : 'text-slate-400'
          return (
            <Link
              key={href}
              href={href}
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
