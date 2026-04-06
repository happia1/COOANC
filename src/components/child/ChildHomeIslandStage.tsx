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

/**
 * 홈·미션 공통: 섬을 카드 쪽으로 당김 (`default`·`viewportFit`).
 */
const LIFT_CLASS = '-translate-y-[9rem] sm:-translate-y-[12rem]'

/**
 * Tailwind 가 빌드 시 인식하도록 **문자열 리터럴**만 사용.
 * `320×280` 기준 캔버스에 섬·토끼·돼지를 두고, `cqw`/`cqh` 로 **한 번에** 축소·확대(최소 0.38 ~ 최대 1.18).
 */
const FLEX_UNIFIED_SCALE_CLASS =
  'pointer-events-none absolute bottom-0 left-1/2 h-[280px] w-[320px] max-w-full origin-bottom overflow-visible [transform:translateX(-50%)_translateY(calc(-1*min(11rem,24cqh)))_scale(clamp(0.38,min(1.18,calc(100cqw/320px),calc(100cqh/280px)),1.18))]'

/** 기본 무대 박스 — 고정 비율(스크롤이 생기기 쉬움). */
const BOX_DEFAULT = 'h-[min(46dvh,400px)] min-h-[280px]'
/** 예전 한 화면 실험용 — 매우 낮은 박스. */
const BOX_VIEWPORT_FIT = 'h-[min(17dvh,148px)] min-h-[96px] max-h-[24vh]'
/**
 * 플렉스 열에 넣을 때: 위쪽 풍경 안에서 **남는 높이**만 쓰되 너무 작거나 크지 않게 상한·하한.
 * (고정 `min-h-[280px]` 대신 줄어들 수 있어 전체 페이지 세로 스크롤을 막기 쉬움.)
 */
const BOX_FLEX =
  'w-full flex-1 basis-0 min-h-[64px] max-h-[min(40dvh,320px)] overflow-visible sm:max-h-[min(42dvh,360px)]'

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
  /** `flex`: 부모가 플렉스로 높이를 나눠 줄 때(홈·미션 한 화면). `viewportFit`: 예전 초소형 박스. */
  density?: 'default' | 'viewportFit' | 'flex'
  /**
   * 미션 탭 전용: 오늘 완료한 미션 수 / 오늘 전체 미션 수.
   * 넘기면 섬 위에 저금통 스프라이트가 올라가고, 완료 비율에 맞춰 프레임이 바뀝니다.
   */
  missionPiggy?: { completed: number; total: number }
}

/**
 * 홈 캐릭터 무대 / 미션 지피뱅크 섬.
 * - `default`: 고정 높이 박스 + `LIFT_CLASS` 로 섬만 위로 당김.
 * - `flex`: **컨테이너 쿼리**로 무대 박스 가로·세로에 맞춰 섬·토끼·돼지가 한꺼번에 확대·축소됨.
 */
export default function ChildHomeIslandStage({
  scene = 'bunny',
  density = 'default',
  missionPiggy,
}: Props) {
  const src = ISLAND_IMAGE_SRC[scene]
  const box =
    density === 'viewportFit' ? BOX_VIEWPORT_FIT : density === 'flex' ? BOX_FLEX : BOX_DEFAULT
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

  /** 섬·토끼·돼지 레이어 (flex / 비-flex 공통 JSX) */
  const stageLayers = (
    <>
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
          {density === 'flex' ? (
            /** flex: 섬·무대 스케일과 별도로 토끼만 약간 축소(`scale(0.9)`) */
            <div
              role="img"
              aria-label="나의 쿠앵이 캐릭터"
              className="origin-bottom [transform:translateY(0.125rem)_scale(0.9)]"
            >
              <CharacterSprite
                character="bunny"
                frame={BUNNY_FRONT_FRAME}
                width={108}
                height={238}
                className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.14)]"
              />
            </div>
          ) : (
            /**
             * 비-flex: 토끼만 뷰포트 너비 기준으로 살짝 키움/줄임(섬과 따로 놀지 않게 이미 상한을 둠).
             */
            <div
              role="img"
              aria-label="나의 쿠앵이 캐릭터"
              className="origin-bottom [transform:translateY(0.25rem)_scale(calc(clamp(0.72,calc(min(100vw,20rem)/300),1.08)*0.9))]"
            >
              <CharacterSprite
                character="bunny"
                frame={BUNNY_FRONT_FRAME}
                width={108}
                height={238}
                className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.14)]"
              />
            </div>
          )}
        </div>
      ) : null}

      {scene === 'gippybank' && missionPiggy ? (
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
    </>
  )

  if (density === 'flex') {
    // `[container-type:size]`: 이 박스가 `cqw`/`cqh` 기준이 되고, 안쪽 transform 의 scale 이 반응형으로 동작함.
    return (
      <div
        className={`relative mx-auto w-full ${stageMaxClass} ${box} [container-type:size] overflow-visible`}
      >
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center overflow-visible">
          <div className={FLEX_UNIFIED_SCALE_CLASS}>
            <div className="relative h-full w-full overflow-visible">{stageLayers}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative mx-auto w-full ${stageMaxClass} ${LIFT_CLASS} ${box}`.trim()}>
      {stageLayers}
    </div>
  )
}
