'use client'

import Image from 'next/image'
import SpriteImage from '@/components/common/SpriteImage'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import { piggyBankStageCount } from '@/constants/piggyBankStages'
import { ICONS } from '@/constants/sprites'

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
 * 오늘 미션 완료 개수와 전체 개수로, 단계 인덱스를 고릅니다.
 * - 미션 0개면 항상 가장 빈 그림(0번)
 * - 전부 완료면 가장 찬 그림(마지막)
 * - 그 사이는 비율로 중간 프레임을 고릅니다 (미션이 3개면 0→1→2→3 단계로 나뉨)
 */
function piggyBankFrameIndex(completed: number, total: number): number {
  const n = piggyBankStageCount()
  if (n <= 1) return 0
  if (total <= 0) return 0
  const safeDone = Math.max(0, Math.min(completed, total))
  return Math.round((safeDone / total) * (n - 1))
}

/** 저금통에 넣은 비율로 그림이 차 보이게(미션 완료 수 대신 금액 기반) */
function piggyBankFrameIndexFromPiggy(piggy: number): number {
  const n = piggyBankStageCount()
  if (n <= 1) return 0
  /** 요청사항: 저금통 단계 최대치는 항상 500 크레딧 기준 */
  const t = Math.max(1, 500)
  const safePiggy = Math.max(0, Math.min(piggy, t))
  const ratio = safePiggy / t
  return Math.round(ratio * (n - 1))
}

/** 미션 섬: 저금통(왼쪽)·지갑(오른쪽)·가운데 크레딧(동전 더미 아이콘) — 탭하면 옮기기 시트가 뜹니다 */
export type MissionCreditIslandProps = {
  floating: number
  wallet: number
  piggy: number
  onCenterTap: () => void
  onWalletTap: () => void
  onPiggyTap: () => void
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
   * `missionCredits` 가 없을 때만 섬 위 단일 저금통(완료 비율)을 씁니다.
   */
  missionPiggy?: { completed: number; total: number }
  /** 지갑·저금통·섬(가용) 분리 UI — 있으면 `missionPiggy` 단일 저금통은 숨깁니다 */
  missionCredits?: MissionCreditIslandProps
  /**
   * false: 섬·바다·잔디가 그려진 큰 PNG(`kids_background_island*.png`)를 그리지 않습니다.
   * 미션 탭처럼 잔디 느낌만 빼고 저금통·지갑·크레딧 UI 는 그대로 둘 때 씁니다.
   */
  showIslandArt?: boolean
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
  missionCredits,
  showIslandArt = true,
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
    /** missionCredits가 있으면 항상 '저금통 크레딧' 기준으로 단계를 계산합니다. */
    scene === 'gippybank' && missionCredits
      ? piggyBankFrameIndexFromPiggy(missionCredits.piggy)
      : scene === 'gippybank' && missionPiggy
        ? piggyBankFrameIndex(missionPiggy.completed, missionPiggy.total)
        : 0

  /** 섬·토끼·돼지 레이어 (flex / 비-flex 공통 JSX) */
  const stageLayers = (
    <>
      {showIslandArt ? (
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
      ) : null}

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

      {scene === 'gippybank' && missionCredits ? (
        <>
          {/**
           * 가운데: 아직 나누지 않은 크레딧 — `public/.../credits.png` 스프라이트에서
           * 금액이 클수록 「더 많이 쌓인」 그림 칸을 골라 보여 줍니다.
           * 금액이 0이면 흐리게만 표시하고, 탭해도 시트가 뜨지 않게 부모에서 막습니다.
           */}
          {/** 요청 반영: 가운데 크레딧을 더 많이 위로 올려 겹침 여유를 크게 확보합니다. */}
          <div className="pointer-events-auto absolute bottom-[43%] left-1/2 z-[4] flex -translate-x-1/2 flex-col items-center sm:bottom-[38%]">
            <button
              type="button"
              disabled={missionCredits.floating <= 0}
              onClick={missionCredits.onCenterTap}
              aria-label={
                showIslandArt
                  ? `섬에 쌓인 크레딧 ${missionCredits.floating}. 눌러서 지갑이나 저금통으로 옮기기`
                  : `아직 나누지 않은 크레딧 ${missionCredits.floating}. 눌러서 지갑이나 저금통으로 옮기기`
              }
              className={`flex flex-col items-center rounded-2xl px-2 pb-1 pt-0.5 transition-transform active:scale-[0.97] ${
                missionCredits.floating <= 0 ? 'opacity-45' : ''
              }`}
            >
              <div className="flex h-[56px] w-[68px] items-end justify-center">
                <FloatingCreditsStackVisual
                  floating={missionCredits.floating}
                  dimWhenEmpty={false}
                  displayWidth={58}
                  className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
                />
              </div>
              {/** 요청 반영: 배경 블록 없이 숫자만 크게 표시합니다. */}
              <span className="mt-0.5 text-xl font-black tabular-nums text-brand-blue sm:text-2xl">
                {missionCredits.floating.toLocaleString('ko-KR')}
              </span>
            </button>
          </div>

          {/** 왼쪽 아래: 저금통 (예전 오른쪽 위치를 좌측으로 옮김) */}
          {/** 왼쪽 저금통(황금돼지)도 함께 위로 이동 */}
          <div className="pointer-events-auto absolute bottom-[13%] left-[2%] z-[4] sm:bottom-[14%] sm:left-[4%]">
            <button
              type="button"
              onClick={missionCredits.onPiggyTap}
              aria-label={`저금통 크레딧 ${missionCredits.piggy}. 눌러서 옮기기`}
              className="flex flex-col items-center rounded-2xl p-1 transition-transform active:scale-[0.97]"
            >
              {/** 요청 반영: 황금돼지를 더 강조하기 위해 지갑보다 크게 표시 */}
              {/**
               * 단계 그림은 `piggyBankStages.ts` 에서 URL 목록 또는 합성 PNG 의 픽셀 영역으로 정합니다.
               * 규격 그리드(3x3) 가 아니어도 됩니다.
               */}
              {/** 큰 프레임(왕관/의자) 머리 잘림 방지를 위해 높이 여유 + overflow-visible 적용 */}
              <div className="flex h-[96px] w-[76px] items-end justify-center overflow-visible">
                <PiggyBankStageVisual
                  stepIndex={piggyIdx}
                  displayWidth={70}
                  className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
                />
              </div>
              {/** 요청 반영: 배경 블록 없이 숫자만 크게 표시합니다. */}
              <span className="mt-1 text-lg font-black tabular-nums text-sky-900 sm:text-xl">
                {missionCredits.piggy.toLocaleString('ko-KR')}
              </span>
            </button>
          </div>

          {/** 오른쪽 아래: 지갑 (예전 왼쪽 위치를 우측으로 옮김) */}
          {/** 오른쪽 지갑도 동일한 기준으로 위로 이동 */}
          <div className="pointer-events-auto absolute bottom-[14%] right-[4%] z-[4] sm:bottom-[15%] sm:right-[6%]">
            <button
              type="button"
              onClick={missionCredits.onWalletTap}
              aria-label={`지갑 크레딧 ${missionCredits.wallet}. 눌러서 옮기기`}
              className="flex flex-col items-center rounded-2xl p-1 transition-transform active:scale-[0.97]"
            >
              <SpriteImage sheet={ICONS} frame="wallet" width={56} clipRotated={false} className="drop-shadow-lg" />
              {/** 요청 반영: 배경 블록 없이 숫자만 크게 표시합니다. */}
              <span className="mt-1 text-lg font-black tabular-nums text-amber-900 sm:text-xl">
                {missionCredits.wallet.toLocaleString('ko-KR')}
              </span>
            </button>
          </div>
        </>
      ) : scene === 'gippybank' && missionPiggy ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[11%] z-[2] flex justify-center overflow-visible sm:bottom-[12%]">
          <div
            role="img"
            aria-label={`오늘 미션 저금통 ${missionPiggy.completed}개 완료, 전체 ${missionPiggy.total}개`}
            className="origin-bottom translate-y-0.5 transition-transform duration-500 ease-out"
          >
            {/** 단일 저금통 표시도 같은 단계 규칙(`piggyBankStages.ts`)을 씁니다. */}
            <div className="flex h-[118px] w-[118px] items-end justify-center">
              <PiggyBankStageVisual
                stepIndex={piggyIdx}
                displayWidth={118}
                className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
              />
            </div>
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
