'use client'

import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

type Props = {
  /** 섬에 아직 나누지 않은 크레딧(가용) — 많을수록 더 풍성한 단계 이미지 */
  floating: number
  /** 0일 때 흐리게(버튼 비활성과 맞춤) */
  dimWhenEmpty?: boolean
  /** 한 칸을 화면에 보여 줄 때 가로 크기(px) */
  displayWidth?: number
  className?: string
}

/**
 * 크레딧 양을 1~5단계로 단순화합니다.
 * - 단계가 올라갈수록 동전 더미를 여러 겹으로 겹쳐서 「더 많이 쌓인 느낌」을 만듭니다.
 */
function floatingToStackCount(floating: number): number {
  if (floating <= 0) return 1
  if (floating < 10) return 1
  if (floating < 30) return 2
  if (floating < 70) return 3
  if (floating < 140) return 4
  return 5
}

/**
 * 아이 미션 섬 가운데: 크레딧이 쌓일수록 동전 더미가 겹쳐 보이게 렌더링합니다.
 * - 기존 그리드 크롭 방식(잘림 이슈)을 제거해, 어떤 화면에서도 안정적으로 보입니다.
 */
export default function FloatingCreditsStackVisual({
  floating,
  dimWhenEmpty = true,
  displayWidth = 58,
  className = '',
}: Props) {
  const stackCount = floatingToStackCount(floating)
  const displayHeight = Math.round(displayWidth * 0.92)

  const opacityClass = floating <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'

  return (
    <div
      className={`relative shrink-0 ${opacityClass} ${className}`.trim()}
      style={{ width: displayWidth, height: displayHeight }}
      aria-hidden
    >
      {/**
       * `icons.png`의 `credits` 프레임을 여러 장 겹쳐 배치합니다.
       * - 같은 자산 계열을 써서 톤을 유지하면서도 잘림 없이 "쌓임"을 표현합니다.
       */}
      {Array.from({ length: stackCount }).map((_, i) => {
        const width = Math.round(displayWidth - i * 4)
        const bottom = i * 4
        const jitterX = i % 2 === 0 ? -i : i
        return (
          <span
            key={`credit-stack-${i}`}
            className="absolute left-1/2"
            style={{ bottom, transform: `translateX(calc(-50% + ${jitterX}px))` }}
          >
            <SpriteImage
              sheet={ICONS}
              frame="credits"
              width={Math.max(34, width)}
              clipRotated={false}
              className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
            />
          </span>
        )
      })}
    </div>
  )
}
