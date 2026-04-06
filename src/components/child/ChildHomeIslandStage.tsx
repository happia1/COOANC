'use client'

import Image from 'next/image'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'

/**
 * bunny.png 아틀라스에서 정면에 가까운 프레임.
 * (레이어 21 은 옆모습이었고, 19 를 정면으로 씁니다.)
 */
const BUNNY_FRONT_FRAME = '레이어 19' as const

const LIFT_CLASS = '-translate-y-[9rem] sm:-translate-y-[12rem]'

/** 기본 무대 박스 — `viewportFit` 은 한 화면용으로만 낮춤(translate 동일). */
const BOX_DEFAULT = 'h-[min(46dvh,400px)] min-h-[280px]'
const BOX_VIEWPORT_FIT = 'h-[min(17dvh,148px)] min-h-[96px] max-h-[24vh]'

const ISLAND_IMAGE_SRC = {
  bunny: '/assets/img/layouts/backgrounds/kids_background_island.png',
  gippybank: '/assets/img/layouts/backgrounds/kids_background_island_gippybank.png',
} as const

type Props = {
  /**
   * `bunny`: 홈 — 일반 섬 + 토끼.
   * `gippybank`: 미션 — 지피뱅크 섬만, **박스·translate 는 bunny 와 동일**해 위치가 맞음.
   */
  scene?: 'bunny' | 'gippybank'
  /** `viewportFit`: 홈·미션 한 화면 맞출 때 무대 높이만 줄임 */
  density?: 'default' | 'viewportFit'
}

/**
 * 홈 캐릭터 무대 / 미션 지피뱅크 섬.
 * `justify-end` 로 바닥에 붙은 뒤 `-translate-y` 로 섬(·토끼)만 같은 만큼 올립니다.
 */
export default function ChildHomeIslandStage({ scene = 'bunny', density = 'default' }: Props) {
  const src = ISLAND_IMAGE_SRC[scene]
  const box = density === 'viewportFit' ? BOX_VIEWPORT_FIT : BOX_DEFAULT

  /**
   * 미션(`gippybank`)은 알약·무대 박스는 그대로 두고 **섬 PNG 만** 살짝 위로(홈은 토끼+섬을 부모 `-mt` 로 통째로 올림).
   */
  const islandLayerClass =
    scene === 'gippybank'
      ? 'pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-visible -translate-y-2 sm:-translate-y-3'
      : 'pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-visible'

  return (
    <div className={`relative mx-auto w-full max-w-[20rem] ${LIFT_CLASS} ${box}`.trim()}>
      <div className={islandLayerClass}>
        <Image
          src={src}
          alt=""
          width={900}
          height={420}
          className="h-auto w-[118%] max-w-none select-none object-contain object-bottom [transform:translateY(4%)]"
          priority={scene === 'gippybank'}
        />
      </div>

      {scene === 'bunny' ? (
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
      ) : null}
    </div>
  )
}
