'use client'

import Image from 'next/image'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'

/**
 * bunny.png 아틀라스에서 정면에 가까운 프레임.
 * (레이어 21 은 옆모습이었고, 19 를 정면으로 씁니다.)
 */
const BUNNY_FRONT_FRAME = '레이어 19' as const

/**
 * 홈 캐릭터 무대 — 미션과 같은 박스 크기.
 * 홈에서는 `justify-end` 로 바닥에 붙으므로 `-translate-y` 로 섬·토끼만 위로 올립니다.
 *
 * Tailwind 기본 `translate-y-18` 등이 번들에 안 잡히면 효과가 없을 수 있어,
 * **임의 값 `[…rem]`** 으로 항상 적용되게 합니다.
 * 이전 `translate-y-18`(4.5rem) 대비, 네 번 분량으로 약 +3rem / sm +3rem 더 올림 → 7.5rem / 8.5rem.
 */
export default function ChildHomeIslandStage() {
  return (
    <div className="relative mx-auto h-[min(46dvh,400px)] min-h-[280px] w-full max-w-[20rem] -translate-y-[7.5rem] sm:-translate-y-[8.5rem]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-visible">
        <Image
          src="/assets/img/layouts/backgrounds/kids_background_island.png"
          alt=""
          width={900}
          height={420}
          className="h-auto w-[118%] max-w-none select-none object-contain object-bottom [transform:translateY(4%)]"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[7%] z-[2] flex justify-center">
        <div role="img" aria-label="나의 쿠앵이 캐릭터" className="translate-y-1">
          <CharacterSprite
            character="bunny"
            frame={BUNNY_FRONT_FRAME}
            width={108}
            height={238}
            className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.14)]"
          />
        </div>
      </div>
    </div>
  )
}
