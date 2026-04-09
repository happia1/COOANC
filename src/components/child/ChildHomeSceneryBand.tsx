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
  /**
   * 배경 위·알약·섬보다 위(z)에 그리는 레이어(미션 완료 크레딧 낙하 등).
   * `pointer-events-none` 을 넣어 두면 하단 버튼이 막히지 않음.
   */
  overlay?: ReactNode
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
   * true: 부모 안에서 위쪽 flex 몫 — 아래 패널과 합 맞춤(기본 6, 미션은 5.5 등).
   * false: 고정 `60dvh`(옛 비율; 스크롤이 생길 수 있음).
   */
  flexFill?: boolean
  /** `flexFill` 일 때 위 밴드의 `flex-grow` 비율. 미션 탭은 5.5(하단 4.5와 합), 홈은 기본 6. */
  flexFillWeight?: 5 | 5.5 | 6
  /**
   * true(기본): 하늘·잔디가 그려진 큰 풍경 그림을 깔아요(`backgroundSrc` 또는 기본 PNG).
   * false: 그 그림은 빼고, 앱 페이지의 기본 배경색만 보이게 해요(홈·미션에서 사용).
   */
  showBackground?: boolean
  /**
   * 상단 풍경에 쓸 PNG 경로(`public` 기준, 예: `/assets/.../foo.png`).
   * `showBackground` 가 true 일 때만 적용되고, 비우면 홈과 같은 `kids_background.png` 를 씁니다.
   */
  backgroundSrc?: string
  /**
   * 배경 `Image` 에만 붙는 `object-*` 클래스(기본: 가운데 맞춤).
   * 섬·잔디가 아래쪽에 있으면 `object-bottom` 등으로 맞출 수 있습니다.
   */
  backgroundObjectClassName?: string
  /**
   * `fullscreen`: 밴드 전체를 덮는 직사각형(기본, `object-cover` 등).
   * `circleContain`: **원형** 안에 그림 전체를 넣음(`object-contain`) — 가장자리가 잘리지 않습니다.
   */
  backgroundLayout?: 'fullscreen' | 'circleContain'
}

/**
 * 자녀 앱 상단 풍경 밴드 — 홈·미션 동일
 *
 * - 높이: `flexFill` 이면 `flex-[6]` 또는 `flexFillWeight`(아래 패널과 합 맞춤), 아니면 `h-[60dvh]` + `min-h-[220px]`
 * - 배경: `showBackground` 가 true 일 때만 `object-cover` 풍경 PNG + 기본 `CHILD_HOME_SCENERY_BG_LIFT_CLASS`.
 *   `backgroundSrc` 를 주면 그 경로의 PNG 를 쓰고, 없으면 홈과 같은 `kids_background.png` 를 씁니다.
 */
const DEFAULT_SCENERY_BACKGROUND_SRC = '/assets/img/layouts/backgrounds/kids_background.png'

export default function ChildHomeSceneryBand({
  children,
  overlay = null,
  ariaLabel = '배경',
  className = '',
  backgroundImageClassName = CHILD_HOME_SCENERY_BG_LIFT_CLASS,
  flexFill = false,
  flexFillWeight = 6,
  showBackground = true,
  backgroundSrc,
  backgroundObjectClassName = 'object-cover object-center',
  backgroundLayout = 'fullscreen',
}: Props) {
  /** `showBackground` 가 켜졌을 때 실제로 깔리는 이미지 URL */
  const sceneryImageSrc = backgroundSrc ?? DEFAULT_SCENERY_BACKGROUND_SRC
  /** 원형 모드: 잘리지 않게 `contain` 고정 — `backgroundObjectClassName` 은 무시합니다 */
  const backgroundImageClass =
    backgroundLayout === 'circleContain' ? 'object-contain object-center' : backgroundObjectClassName
  const heightClass = flexFill
    ? flexFillWeight === 5.5
      ? 'min-h-0 flex-[5.5] basis-0'
      : flexFillWeight === 5
        ? 'min-h-0 flex-[5] basis-0'
        : 'min-h-0 flex-[6] basis-0'
    : 'h-[60dvh] min-h-[220px] shrink-0'

  /**
   * `overflow-x` 와 `overflow-y` 를 다르게 두면(한쪽 hidden) 브라우저가 `visible` 축을 `auto` 로 바꿔
   * 세로로 잘리는 버그가 날 수 있어, 미션·홈에서 스프라이트가 위로 나올 때는 **양축 visible** 만 씁니다.
   * 가로 넘침은 `max-w`·부모 패딩으로 막습니다.
   */
  const overflowClass = 'overflow-visible'

  return (
    <section
      className={`relative isolate -mx-4 -mt-4 flex flex-col ${overflowClass} ${heightClass} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {showBackground && backgroundLayout === 'circleContain' ? (
        // 원형 마스크 + contain 만 — 잔디 PNG 뒤에 색·그림자·테두리 같은 별도 ‘원배경’은 넣지 않음.
        <div
          className="pointer-events-none absolute inset-0 z-0 flex items-end justify-center px-3 pb-1 pt-10 sm:px-4 sm:pb-2 sm:pt-12"
          aria-hidden
        >
          <div className="relative aspect-square w-[min(86vw,316px)] max-w-[316px] shrink-0 overflow-hidden rounded-full bg-transparent">
            <Image
              src={sceneryImageSrc}
              alt=""
              fill
              className={backgroundImageClass}
              sizes="316px"
              priority
            />
          </div>
        </div>
      ) : showBackground ? (
        <div
          className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${backgroundImageClassName}`.trim()}
          aria-hidden
        >
          <Image
            src={sceneryImageSrc}
            alt=""
            fill
            className={backgroundImageClass}
            sizes="(max-width: 448px) 100vw, 448px"
            priority
          />
        </div>
      ) : null}

      {overlay}

      {/** 배경(잔디 원 등)보다 섬·크레딧 UI 가 확실히 위에 그려지도록 z 를 둠 */}
      <div className="relative z-20 flex min-h-0 flex-1 flex-col overflow-visible px-4 pb-0 pt-4">{children}</div>
    </section>
  )
}
