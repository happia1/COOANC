'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'

/**
 * 배경 PNG 래퍼에만 적용 — 잔디·하늘만 위로, 알약·섬·캐릭터(자식) 레이어는 이 transform 과 무관하게 그대로.
 * 퍼센트를 키우면 배경만 더 위로 당겨져 하늘이 더 보입니다.
 * `overflow-hidden` 은 이 div(및 section)에서 잘림 처리.
 */
export const CHILD_HOME_SCENERY_BG_LIFT_CLASS = '-translate-y-[24%] scale-[1.1]'

type Props = {
  /** 연속일·크레딧, 섬·캐릭터 등 */
  children: ReactNode
  /** 접근성: 섹션 설명 (미션은 "미션 배경", 홈은 "홈 배경" 등) */
  ariaLabel?: string
  /** `<section>` 에 추가 클래스 */
  className?: string
  /**
   * 배경 이미지를 감싸는 레이어에만 적용할 Tailwind 클래스.
   * 빈 문자열이면 리프트 없음. 기본은 홈·미션 공통으로 잔디만 살짝 위로.
   */
  backgroundImageClassName?: string
  /**
   * true: 부모 flex 안에서 남는 높이만 씀(홈·미션 한 화면 맞춤).
   * false: 고정 `60dvh`(다른 탭에서 쓸 때).
   */
  flexFill?: boolean
}

/**
 * 자녀 앱 상단 풍경 밴드 — 홈·미션 동일
 *
 * - 높이: `flexFill` 이면 `flex-1 min-h-0`, 아니면 `h-[60dvh]` + `min-h-[220px]`
 * - 배경: `object-cover object-center`, 기본 `CHILD_HOME_SCENERY_BG_LIFT_CLASS`
 */
export default function ChildHomeSceneryBand({
  children,
  ariaLabel = '배경',
  className = '',
  backgroundImageClassName = CHILD_HOME_SCENERY_BG_LIFT_CLASS,
  flexFill = false,
}: Props) {
  const heightClass = flexFill
    ? 'min-h-0 flex-1 basis-0'
    : 'h-[60dvh] min-h-[220px] shrink-0'

  return (
    <section
      className={`relative isolate -mx-4 -mt-4 flex flex-col overflow-hidden ${heightClass} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${backgroundImageClassName}`.trim()}
        aria-hidden
      >
        <Image
          src="/assets/img/layouts/backgrounds/kids_background.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="(max-width: 448px) 100vw, 448px"
          priority
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-0 pt-4">{children}</div>
    </section>
  )
}
