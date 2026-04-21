'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DockTabIcon, type DockTabIconId } from '@/components/navigation/DockTabIcons'

/**
 * 아이 앱 내비게이션 바
 * - 모바일: 하단 고정(fixed bottom-0), 가로 배열
 * - 태블릿 landscape (md + landscape): 좌측 사이드바(relative flex-col), 레이아웃 흐름에 참여
 *
 * pendingHref: 탭을 누르면 라우터 완료를 기다리지 않고 즉시 활성 표시를 바꿉니다.
 */
const TABS: readonly { href: string; label: string; icon: DockTabIconId }[] = [
  { href: '/home', label: '홈', icon: 'home' },
  { href: '/mission', label: '미션', icon: 'smile' },
  { href: '/market', label: '마켓', icon: 'market' },
] as const

type Props = {
  isParentPreview?: boolean
}

export default function ChildNavBar({ isParentPreview = false }: Props) {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  const effectivePath = pendingHref ?? pathname

  return (
    <nav
      className={[
        // 모바일: fixed 하단 독바
        'fixed bottom-0 left-0 right-0 z-50 flex flex-row',
        'border-t border-gray-100 bg-white/90 shadow-lg backdrop-blur-sm',
        // 태블릿 landscape: relative 좌측 사이드바
        'md:landscape:relative md:landscape:bottom-auto md:landscape:left-auto md:landscape:right-auto',
        'md:landscape:z-auto md:landscape:flex-col',
        'md:landscape:h-full md:landscape:w-14 md:landscape:shrink-0',
        'md:landscape:border-t-0 md:landscape:border-r md:landscape:shadow-none',
        'md:landscape:bg-white md:landscape:backdrop-blur-none',
      ].join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch md:landscape:h-full md:landscape:w-full md:landscape:max-w-none md:landscape:flex-col md:landscape:items-center md:landscape:py-2">
        {TABS.map(({ href, label, icon }) => {
          const isActive = effectivePath === href || effectivePath.startsWith(href + '/')
          const tone = isActive ? 'text-slate-700' : 'text-slate-400'

          const inner = (
            <>
              {/* 모바일: 상단 밑줄 인디케이터 */}
              {isActive && (
                <span className="absolute top-0 left-1/2 h-1 w-7 -translate-x-1/2 rounded-b-full bg-slate-700 md:landscape:hidden" />
              )}
              {/* 태블릿 landscape: 좌측 세로 인디케이터 */}
              {isActive && (
                <span className="absolute left-0 top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-r-full bg-slate-700 md:landscape:block" />
              )}
              <DockTabIcon id={icon} className={`h-7 w-7 shrink-0 ${tone}`} />
              <span className={`text-xs font-bold leading-none md:landscape:hidden ${tone}`}>{label}</span>
            </>
          )

          const sharedCls = [
            'relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] transition-transform active:scale-95',
            'md:landscape:w-full md:landscape:flex-none md:landscape:flex-row md:landscape:justify-center md:landscape:min-h-0 md:landscape:py-4',
          ].join(' ')

          if (isParentPreview) {
            return (
              <a
                key={href}
                href={href}
                onClick={() => setPendingHref(href)}
                className={`${sharedCls} no-underline text-inherit`}
              >
                {inner}
              </a>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onClick={() => setPendingHref(href)}
              className={sharedCls}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
