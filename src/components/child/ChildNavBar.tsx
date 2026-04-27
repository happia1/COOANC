'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DockTabIcon, type DockTabIconId } from '@/components/navigation/DockTabIcons'
import { useChildAppProfile } from '@/context/ProfileContext'

/**
 * 아이 앱 내비게이션 바
 * - 모바일: 하단 고정(fixed bottom-0), 가로 배열, 마지막 탭에 나가기 버튼 포함
 * - 태블릿 landscape (md + landscape): 좌측 사이드바(relative flex-col), 나가기 버튼은 하단에 mt-auto
 *
 * pendingHref: 탭을 누르면 라우터 완료를 기다리지 않고 즉시 활성 표시를 바꿉니다.
 */
/**
 * 자녀앱은 `/home` 단일 화면(ChildScreen) — 미션·마켓은 앱 내부 패널/카드.
 * (현재 layout 에서는 이 바를 쓰지 않을 수 있으나, 링크가 남으면 404가 나지 않게 홈만 둡니다.)
 */
const TABS: readonly { href: string; label: string; icon: DockTabIconId }[] = [
  { href: '/home', label: '홈', icon: 'home' },
] as const

type Props = {
  isParentPreview?: boolean
}

const tabItemCls = [
  'relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] transition-transform active:scale-95',
  /**
   * 태블릿 가로 독바: 아이콘 아래 텍스트를 함께 보여 주고,
   * 탭 간 구분이 잘 되도록 내부 간격/패딩을 키웁니다.
   */
  'md:landscape:w-full md:landscape:flex-none md:landscape:flex-col md:landscape:justify-center md:landscape:gap-2 md:landscape:min-h-0 md:landscape:py-5',
].join(' ')

const exitItemCls = [
  /**
   * 요청사항: 모바일 하단 독바에서는 나가기 버튼을 숨기고,
   * 태블릿 가로 사이드바에서만 표시합니다.
   */
  'relative hidden flex-1 flex-col items-center justify-center gap-1 min-h-[56px] transition-transform active:scale-95 no-underline text-inherit md:landscape:flex',
  /**
   * 요청사항: 나가기 버튼은 태블릿 가로 독바의 맨 아래에 배치합니다.
   */
  'md:landscape:w-full md:landscape:flex-none md:landscape:flex-col md:landscape:justify-center md:landscape:min-h-0 md:landscape:py-3 md:landscape:mt-auto',
].join(' ')

export default function ChildNavBar({ isParentPreview = false }: Props) {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const profile = useChildAppProfile()
  const exitHref = profile?.exitHref ?? '/parent/home'

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
        'md:landscape:h-full md:landscape:w-20 md:landscape:shrink-0',
        'md:landscape:border-t-0 md:landscape:border-r md:landscape:shadow-none',
        'md:landscape:bg-white md:landscape:backdrop-blur-none',
      ].join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 w-full items-stretch md:landscape:h-full md:landscape:w-full md:landscape:max-w-none md:landscape:flex-col md:landscape:items-center md:landscape:justify-center md:landscape:gap-2 md:landscape:py-3">
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
              <DockTabIcon id={icon} className={`h-8 w-8 shrink-0 ${tone}`} />
              <span className={`text-xs font-bold leading-none md:landscape:block md:landscape:text-[11px] ${tone}`}>{label}</span>
            </>
          )

          if (isParentPreview) {
            return (
              <a
                key={href}
                href={href}
                onClick={() => setPendingHref(href)}
                className={`${tabItemCls} no-underline text-inherit`}
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
              className={tabItemCls}
            >
              {inner}
            </Link>
          )
        })}

        {/* 나가기 버튼: 모바일 독 마지막 탭 + 태블릿 사이드바 하단(mt-auto) */}
        <a href={exitHref} className={exitItemCls} aria-label="나가기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/img/common/ui/exit.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain opacity-60"
          />
          <span className="text-xs font-bold leading-none text-slate-400">나가기</span>
        </a>
      </div>
    </nav>
  )
}
