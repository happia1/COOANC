'use client'

import { useEffect, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import { EFFECT_BALLOONS } from '@/constants/effectsBalloonsAtlas'

type Props = {
  /** 부모가 바꿀 때마다 애니메이션 처음부터 다시 */
  playId: number
  /** 연출 종료 후 호출 — 오버레이 언마운트용 */
  onFinish: () => void
}

/** balloons 아틀라스 조각 — 72×72 박스 기준 left/top(px), 애니 `transform` 과 겹치지 않게 픽셀 배치 */
const BALLOON_SPARKLE_SPEC: { frame: keyof typeof EFFECT_BALLOONS.frames; left: number; top: number; delay: number }[] = [
  { frame: 'yellow', left: 2, top: 4, delay: 0 },
  { frame: 'red', left: 54, top: 10, delay: 80 },
  { frame: 'blue', left: 6, top: 44, delay: 160 },
  { frame: 'green', left: 50, top: 48, delay: 240 },
  { frame: 'yellow', left: 34, top: 0, delay: 120 },
]

/**
 * 미션 카드 탭 완료 시: 풍경 밴드 안에서만 보이는 연출.
 * - `icons.png` 의 `credit` → 잠시 후 `credit_wink` 로 바뀜
 * - 위→아래로 떨어지며 `globals.css` 의 `mission-credit-to-piggy` 적용
 * - `effects/balloons.png` 프레임으로 반짝(없으면 CSS 점만 보임)
 */
export default function MissionCreditToPiggyOverlay({ playId, onFinish }: Props) {
  const [wink, setWink] = useState(false)

  useEffect(() => {
    setWink(false)
    const w = window.setTimeout(() => setWink(true), 400)
    const end = window.setTimeout(() => onFinish(), 1480)
    return () => {
      window.clearTimeout(w)
      window.clearTimeout(end)
    }
  }, [playId, onFinish])

  return (
    <div className="pointer-events-none absolute inset-0 z-[22] overflow-visible" aria-hidden>
      <div
        className="mission-credit-to-piggy-anim absolute left-1/2 top-[5%] flex flex-col items-center [transform-origin:50%_0%]"
        style={{ width: 72 }}
      >
        <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center">
          {BALLOON_SPARKLE_SPEC.map((s, i) => (
            <div
              key={`${playId}-b-${i}`}
              className="mission-credit-sparkle-twinkle pointer-events-none absolute"
              style={{
                left: s.left,
                top: s.top,
                animationDelay: `${s.delay}ms`,
              }}
            >
              <SpriteImage
                sheet={EFFECT_BALLOONS}
                frame={s.frame}
                width={14}
                clipRotated={false}
                className="opacity-95 drop-shadow-[0_0_6px_rgba(255,220,120,0.85)]"
              />
            </div>
          ))}
          {/** PNG 가 없을 때도 반짝이 보이도록 작은 광점(비개발자: 그림 없어도 반짝임) */}
          <span
            className="mission-credit-sparkle-twinkle pointer-events-none absolute left-[30px] top-[30px] h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_12px_3px_rgba(253,224,71,0.95)]"
            style={{ animationDelay: '200ms', marginLeft: -4, marginTop: -4 }}
          />
          <span
            className="mission-credit-sparkle-twinkle pointer-events-none absolute left-[12px] top-[20px] h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.9)]"
            style={{ animationDelay: '90ms' }}
          />
          <span
            className="mission-credit-sparkle-twinkle pointer-events-none absolute left-[52px] top-[24px] h-1.5 w-1.5 rounded-full bg-yellow-200 shadow-[0_0_8px_2px_rgba(250,204,21,0.85)]"
            style={{ animationDelay: '300ms' }}
          />

          <div className="relative z-[2] drop-shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
            <SpriteImage
              sheet={ICONS}
              frame={wink ? 'credit_wink' : 'credit'}
              width={52}
              clipRotated={false}
              className="select-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
