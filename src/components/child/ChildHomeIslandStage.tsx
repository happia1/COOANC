'use client'

import Image from 'next/image'
import SpriteImage from '@/components/common/SpriteImage'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'
import { PIGGY_BANK } from '@/constants/sprites'

/**
 * bunny.png 아틀라스에서 정면에 가까운 프레임.
 * (레이어 21 은 옆모습이었고, 19 를 정면으로 씁니다.)
 */
const BUNNY_FRONT_FRAME = '레이어 19' as const

/** 홈·미션 공통: 섬을 카드 쪽으로 당김 (미션만 따로 줄이면 배경 PNG 와 섬이 어긋나 위가 이상해 보일 수 있음) */
const LIFT_CLASS = '-translate-y-[9rem] sm:-translate-y-[12rem]'

/** 기본 무대 박스 — `viewportFit` 은 한 화면용으로만 낮춤(translate 동일). */
const BOX_DEFAULT = 'h-[min(46dvh,400px)] min-h-[280px]'
const BOX_VIEWPORT_FIT = 'h-[min(17dvh,148px)] min-h-[96px] max-h-[24vh]'

const ISLAND_IMAGE_SRC = {
  bunny: '/assets/img/layouts/backgrounds/kids_background_island.png',
  gippybank: '/assets/img/layouts/backgrounds/kids_background_island_gippybank.png',
} as const

/**
 * `public/assets/img/items/piggy-bank/piggy_bank.png` 510×255 아틀라스(레이어 284 폭은 코드·JSON 에서 124px 로 보정).
 * 앞이 더 비어 있고 뒤로 갈수록 차는 그림 순서입니다.
 */
const PIGGY_BANK_FILL_FRAMES = [
  '레이어 279',
  '레이어 280',
  '레이어 281',
  '레이어 282',
  '레이어 283',
  '레이어 284',
  '레이어 285',
  '레이어 286',
] as const

/**
 * 오늘 미션 완료 개수와 전체 개수로, 위 배열 중 몇 번째 그림을 쓸지 정합니다.
 * - 미션 0개면 항상 가장 빈 그림(0번)
 * - 전부 완료면 가장 찬 그림(마지막)
 * - 그 사이는 비율로 중간 프레임을 고릅니다 (미션이 3개면 0→1→2→3 단계로 나뉨)
 */
function piggyBankFrameIndex(completed: number, total: number): number {
  const n = PIGGY_BANK_FILL_FRAMES.length
  if (n <= 1) return 0
  if (total <= 0) return 0
  const safeDone = Math.max(0, Math.min(completed, total))
  return Math.round((safeDone / total) * (n - 1))
}

type Props = {
  /**
   * `bunny`: 홈 — 일반 섬 + 토끼.
   * `gippybank`: 미션 — 지피뱅크 섬만, **박스·translate 는 bunny 와 동일**해 위치가 맞음.
   */
  scene?: 'bunny' | 'gippybank'
  /** `viewportFit`: 홈·미션 한 화면 맞출 때 무대 높이만 줄임 */
  density?: 'default' | 'viewportFit'
  /**
   * 미션 탭 전용: 오늘 완료한 미션 수 / 오늘 전체 미션 수.
   * 넘기면 섬 위에 저금통 스프라이트가 올라가고, 완료 비율에 맞춰 프레임이 바뀝니다.
   */
  missionPiggy?: { completed: number; total: number }
}

/**
 * 홈 캐릭터 무대 / 미션 지피뱅크 섬.
 * `justify-end` 로 바닥에 붙은 뒤 `-translate-y` 로 섬(·토끼)만 같은 만큼 올립니다.
 */
export default function ChildHomeIslandStage({
  scene = 'bunny',
  density = 'default',
  missionPiggy,
}: Props) {
  const src = ISLAND_IMAGE_SRC[scene]
  const box = density === 'viewportFit' ? BOX_VIEWPORT_FIT : BOX_DEFAULT
  /** 미션은 부모(`max-w-sm`) 너비를 쓰면 저금통·섬이 좌우로 덜 잘림 */
  const stageMaxClass = scene === 'gippybank' ? 'max-w-sm' : 'max-w-[20rem]'

  /** 미션(`gippybank`)은 알약·무대 박스는 그대로 두고 **섬 PNG 만** 살짝 위로 올립니다. */
  const islandLayerClass =
    scene === 'gippybank'
      ? 'pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-visible -translate-y-1 sm:-translate-y-2'
      : 'pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-visible'

  const piggyIdx =
    scene === 'gippybank' && missionPiggy
      ? piggyBankFrameIndex(missionPiggy.completed, missionPiggy.total)
      : 0
  const piggyFrame = PIGGY_BANK_FILL_FRAMES[piggyIdx]

  return (
    <div className={`relative mx-auto w-full ${stageMaxClass} ${LIFT_CLASS} ${box}`.trim()}>
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

      {/** 미션 섬 위 돼지 저금통: `missionPiggy` 가 있을 때만 그립니다 (휴식일 등은 MissionTab 에서 0/0 으로 비움). */}
      {scene === 'gippybank' && missionPiggy ? (
        /** `overflow-visible`: 회전 스프라이트 가장자리·scale 이 부모에 잘리지 않게 함 */
        <div className="pointer-events-none absolute inset-x-0 bottom-[11%] z-[2] flex justify-center overflow-visible sm:bottom-[12%]">
          <div
            role="img"
            aria-label={`오늘 미션 저금통 ${missionPiggy.completed}개 완료, 전체 ${missionPiggy.total}개`}
            className="origin-bottom translate-y-0.5 transition-transform duration-500 ease-out"
          >
            <SpriteImage
              sheet={PIGGY_BANK}
              frame={piggyFrame}
              width={118}
              clipRotated={false}
              className="select-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
