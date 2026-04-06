'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'

type Props = {
  /** 연속일·크레딧, 섬·캐릭터 등 */
  children: ReactNode
  /** 접근성: 섹션 설명 (미션은 "미션 배경", 홈은 "홈 배경" 등) */
  ariaLabel?: string
  /** 홈 등에서 배경·알약·섬 블록 전체를 살짝 위로 올릴 때 ` -translate-y-2` 등 */
  className?: string
}

/**
 * 자녀 앱 상단 풍경 밴드 — 미션 탭 hero 와 동일 기본 스펙 (홈과 공유)
 *
 * - 높이: `h-[60dvh]` + `min-h-[220px]`
 * - 배경: `kids_background.png`, `object-cover object-top`
 */
export default function ChildHomeSceneryBand({ children, ariaLabel = '배경', className = '' }: Props) {
  return (
    <section
      className={`relative isolate -mx-4 -mt-4 h-[60dvh] min-h-[220px] shrink-0 overflow-hidden ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/assets/img/layouts/backgrounds/kids_background.png"
          alt=""
          fill
          className="object-cover object-top"
          sizes="(max-width: 448px) 100vw, 448px"
          priority
        />
      </div>

      <div className="relative z-10 flex h-full flex-col px-4 pb-0 pt-4">{children}</div>
    </section>
  )
}
