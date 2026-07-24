'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DockTabIcon, type DockTabIconId } from '@/components/navigation/DockTabIcons'

/**
 * 부모 앱 하단 독바
 * - 경로·라벨은 부모 메뉴(홈·루틴·승인), 아이콘 모양은 자녀 독바와 동일한 SVG 를 씁니다.
 */
const TABS: readonly { href: string; label: string; icon: DockTabIconId }[] = [
  { href: '/parent/home', label: '홈', icon: 'home' },
  { href: '/parent/routine', label: '루틴', icon: 'smile' },
  { href: '/parent/approval', label: '승인', icon: 'market' },
] as const

export default function ParentNavBar() {
  const pathname = usePathname()

  return (
    <nav className="
      fixed bottom-0 left-0 right-0 z-40 flex flex-row
      border-t border-gray-100 bg-white shadow-lg
      md:landscape:relative md:landscape:bottom-auto md:landscape:left-auto md:landscape:right-auto
      md:landscape:flex-col md:landscape:w-20 md:landscape:h-full
      md:landscape:border-t-0 md:landscape:border-r md:landscape:border-gray-100 md:landscape:shadow-none
    ">
      {/* 모바일·태블릿 세로: 하단 가로 독바 / 태블릿 가로+데스크톱: 좌측 세로 독바 */}
      <div className="flex h-[60px] w-full items-stretch md:landscape:h-full md:landscape:w-auto md:landscape:flex-col md:landscape:items-stretch">
        {TABS.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          /** 선택 탭은 진한 네이비, 나머지는 연한 회색 */
          const tone = isActive ? 'text-slate-700' : 'text-slate-400'
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors md:landscape:h-16 md:landscape:flex-none"
            >
              {/* 모바일: 상단 수평 바 / md+: 우측 수직 바 */}
              {isActive && (
                <span className="
                  absolute top-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-b-full bg-slate-700
                  md:landscape:top-1/2 md:landscape:right-0 md:landscape:left-auto md:landscape:h-6 md:landscape:w-1 md:landscape:translate-x-0 md:landscape:-translate-y-1/2 md:landscape:rounded-l-full
                " />
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
