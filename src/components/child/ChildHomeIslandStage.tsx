'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'
import { resolveHomeIslandStageSprite, type HomeIslandStageSprite } from '@/lib/childHomeCharacterFromAvatar'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import { MISSION_CREDITS_STAGE_CAP, piggyBankStageCount } from '@/constants/piggyBankStages'
import { EFFECT_LIGHTS, ICONS } from '@/constants/sprites'
type LightFx = { leftPct: number; topPct: number; size: number; delayMs: number; durationMs: number; opacity: number }

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

/**
 * 미션(저금통·지갑 UI): 왕관 등 키 큰 스프라이트가 280px 캔버스 위로 넘칠 수 있어
 * 논리 높이만 320px 로 키우고, cqh 기준도 320에 맞춥니다(홈 토끼 경로는 위 상수 유지).
 * 최대 배율 `1.3` — 전체(아이콘·숫자)를 한꺼번에 조금 키움(이전 1.18).
 */
const FLEX_UNIFIED_SCALE_MISSION_CREDITS_CLASS =
  'pointer-events-none absolute bottom-0 left-1/2 h-[320px] w-[320px] max-w-full origin-bottom overflow-visible [transform:translateX(-50%)_translateY(calc(-1*min(11rem,24cqh)))_scale(clamp(0.38,min(1.3,calc(100cqw/320px),calc(100cqh/320px)),1.3))]'

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
 * 미션 섬 3열(저금통·섬 크레딧·지갑) 아이콘 **뒤**에 깔 맵 일러스트 경로입니다.
 * - `public/assets/img/games/map/` 아래 PNG 를 씁니다.
 * - 레이아웃: 배경은 `z-0` + 오른쪽·아래 모서리 기준으로 겹치고, 돼지·동전·지갑은 그 위(`z-[1]`).
 */
const MISSION_CREDIT_MAP_BACKDROP = {
  piggy: '/assets/img/games/map/bank2.png',
  floating: '/assets/img/games/map/home.png',
  wallet: '/assets/img/games/map/market2.png',
} as const

/**
 * 은행·집·마켓 맵 슬롯 — 세 열 **같은 가로·같은 높이**, 바닥(`bottom-0`) 한 줄 정렬.
 */
const MISSION_MAP_BACKDROP_SLOT_CLASS =
  'pointer-events-none absolute bottom-0 left-1/2 z-0 flex h-[9.5rem] w-[10rem] -translate-x-1/2 items-end justify-end sm:h-[10rem] sm:w-[10.75rem]'

/**
 * 맵 PNG(뒤): 아주 약한 블러 + 밝기 살짝 낮춤 — 건물이 너무 흐리지 않게(이전 1.5px → 1px).
 */
const MISSION_MAP_BACKDROP_SOFTEN_CLASS = 'blur-[1px] brightness-[0.93]'

/** 슬롯 안에서 비율 유지 + 오른쪽·아래 기준 + 뒤쪽 흐림 */
const MISSION_MAP_BACKDROP_IMG_CLASS = `h-full w-full select-none object-contain object-bottom-right ${MISSION_MAP_BACKDROP_SOFTEN_CLASS}`

/**
 * 마켓(`market2.png`) 전용 — `object-cover` 는 가장자리가 잘려 나가므로 쓰지 않습니다.
 * 집과 같이 **전체가 보이게** `object-contain` 을 쓰고, 살짝만 `scale` 로 키웁니다(기준: 오른쪽·아래).
 */
const MISSION_MAP_BACKDROP_IMG_MARKET_CLASS = `h-full w-full overflow-visible select-none object-contain object-bottom-right origin-bottom-right scale-[1.12] sm:scale-[1.15] ${MISSION_MAP_BACKDROP_SOFTEN_CLASS}`

/**
 * 돼지·크레딧 더미·지갑 — 위치는 밀지 않고(오프셋 0), **주변으로만 번지는** 그림자.
 * `drop-shadow(dx dy blur)` 에서 dx·dy 를 0으로 두고 blur 만 여러 겹 겹칩니다.
 */
const MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS =
  '[filter:drop-shadow(0_0_22px_rgba(15,23,42,0.5))_drop-shadow(0_0_12px_rgba(15,23,42,0.38))_drop-shadow(0_0_6px_rgba(0,0,0,0.32))]'

/** 가운데 가용 크레딧 더미만 — 맵보다 살짝 아래 */
const MISSION_CREDIT_SPRITE_NUDGE_DOWN_CLASS = 'translate-y-5 sm:translate-y-6'

/** 지갑: 돼지·가운데와 맞추되 요청에 따라 한 번 더 아래로 */
const MISSION_CREDIT_WALLET_SPRITE_NUDGE_DOWN_CLASS = 'translate-y-8 sm:translate-y-10'

/** 저금통(돼지): 맵과 겹침을 줄이며 아래로 — 지갑과 함께 더 내릴 때 이 값만 키움 */
const MISSION_CREDIT_PIG_SPRITE_NUDGE_DOWN_CLASS = 'translate-y-16 sm:translate-y-20'

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
  /** `MISSION_CREDITS_STAGE_CAP` 기준으로 0~마지막 단계까지 비율 매핑(가용 크레딧 동전과 상한 통일) */
  const t = Math.max(1, MISSION_CREDITS_STAGE_CAP)
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

type SlotNumberProps = {
  /** 목표 숫자(실제 크레딧 값) */
  value: number
  /** 숫자 색상 클래스 */
  toneClass: string
  /** 숫자 크기 클래스 */
  sizeClass: string
  className?: string
}

function SlotDigit({ digit, sizeClass }: { digit: string; sizeClass: string }) {
  if (digit === ',') {
    return <span className={`${sizeClass} leading-none`}>,</span>
  }
  const n = Number(digit)
  return (
    <span className={`relative inline-flex h-[1.15em] w-[0.78em] overflow-hidden ${sizeClass} leading-none`}>
      <span
        className="absolute left-0 top-0 flex flex-col transition-transform duration-200 ease-out"
        style={{ transform: `translateY(-${n * 1.15}em)` }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={`slot-${i}`} className="h-[1.15em] leading-[1.15em]">
            {i}
          </span>
        ))}
      </span>
    </span>
  )
}

/**
 * 슬롯(릴) 숫자:
 * - 목표값으로 바로 점프하지 않고, 짧은 간격으로 서서히 맞춰 갑니다.
 * - 각 자리수는 세로 릴처럼 움직여 올라가거나 내려가는 느낌을 냅니다.
 */
function SlotNumber({ value, toneClass, sizeClass, className = '' }: SlotNumberProps) {
  const target = Math.max(0, Math.floor(value))
  const [displayed, setDisplayed] = useState(target)

  useEffect(() => {
    if (displayed === target) return
    const tick = setInterval(() => {
      setDisplayed((prev) => {
        if (prev === target) return prev
        const diff = target - prev
        const step = Math.max(1, Math.floor(Math.abs(diff) / 8))
        return prev + Math.sign(diff) * step
      })
    }, 45)
    return () => clearInterval(tick)
  }, [target, displayed])

  const chars = useMemo(() => displayed.toLocaleString('ko-KR').split(''), [displayed])

  return (
    <span className={`${className} inline-flex items-center gap-[0.04em] font-black tabular-nums ${toneClass}`}>
      {chars.map((ch, idx) => (
        <SlotDigit key={`digit-${idx}-${ch}`} digit={ch} sizeClass={sizeClass} />
      ))}
    </span>
  )
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
  /**
   * 홈(`scene="bunny"`)일 때만: 자녀 프로필에 저장된 `*_profile.png` URL 과 맞춰
   * 섬 위 정면 캐릭터(여우·토끼·곰 등)를 바꿉니다. 없거나 알 수 없으면 토끼 기본.
   */
  homeAvatarUrl?: string | null
}

/** `HomeIslandStageSprite` 는 캐릭터마다 frame 타입이 달라 분기로 `CharacterSprite` 에 넘깁니다 */
function HomeIslandHeroSprite({
  sprite,
  className,
}: {
  sprite: HomeIslandStageSprite
  className?: string
}) {
  const cls = className ?? 'drop-shadow-[0_8px_16px_rgba(0,0,0,0.14)]'
  switch (sprite.character) {
    case 'bears':
      return (
        <CharacterSprite character="bears" frame={sprite.frame} width={sprite.width} height={sprite.height} className={cls} />
      )
    case 'bunny':
      return (
        <CharacterSprite character="bunny" frame={sprite.frame} width={sprite.width} height={sprite.height} className={cls} />
      )
    case 'chicks':
      return (
        <CharacterSprite character="chicks" frame={sprite.frame} width={sprite.width} height={sprite.height} className={cls} />
      )
    case 'fox':
      return <CharacterSprite character="fox" frame={sprite.frame} width={sprite.width} height={sprite.height} className={cls} />
    case 'hamster':
      return (
        <CharacterSprite character="hamster" frame={sprite.frame} width={sprite.width} height={sprite.height} className={cls} />
      )
  }
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
  homeAvatarUrl = null,
}: Props) {
  const homeStageSprite = resolveHomeIslandStageSprite(homeAvatarUrl)
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
  const [animatedPiggyIdx, setAnimatedPiggyIdx] = useState(piggyIdx)
  const animatedPiggyIdxRef = useRef(animatedPiggyIdx)
  const [piggySparkleOn, setPiggySparkleOn] = useState(false)
  const [piggyLightFx, setPiggyLightFx] = useState<LightFx[]>([])

  /** 9단계 중 마지막 두 칸은 왕관 돼지(343) — 위로 길어 `min-h`·`pt` 로 잘림을 줄입니다. */
  const piggyStageCount = piggyBankStageCount()
  const tallCrownStartIdx = Math.max(0, piggyStageCount - 2)

  useEffect(() => {
    animatedPiggyIdxRef.current = animatedPiggyIdx
  }, [animatedPiggyIdx])

  useEffect(() => {
    /** 저금통 단계가 올라갈 때만 3초 반짝임 */
    if (piggyIdx > animatedPiggyIdxRef.current) {
      /** 단계 상승 시 라이트 여러 개를 랜덤 좌표/속도로 배치합니다. */
      setPiggyLightFx(
        Array.from({ length: 4 }).map(() => ({
          leftPct: 24 + Math.random() * 52,
          topPct: Math.random() * 28,
          size: 18 + Math.floor(Math.random() * 24),
          delayMs: Math.floor(Math.random() * 560),
          durationMs: 1200 + Math.floor(Math.random() * 1300),
          opacity: 0.45 + Math.random() * 0.4,
        })),
      )
      setPiggySparkleOn(true)
      const off = setTimeout(() => setPiggySparkleOn(false), 3000)
      return () => clearTimeout(off)
    }
    return
  }, [piggyIdx])

  useEffect(() => {
    if (piggyIdx === animatedPiggyIdxRef.current) return
    /** 목표 단계까지 한 칸씩 이동해 서서히 커지거나 작아지게 보이도록 처리 */
    const tick = setInterval(() => {
      setAnimatedPiggyIdx((prev) => {
        if (prev === piggyIdx) return prev
        return prev + (piggyIdx > prev ? 1 : -1)
      })
    }, 170)
    return () => clearInterval(tick)
  }, [piggyIdx])

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
              <HomeIslandHeroSprite sprite={homeStageSprite} />
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
              <HomeIslandHeroSprite sprite={homeStageSprite} />
            </div>
          )}
        </div>
      ) : null}

      {scene === 'gippybank' && missionCredits ? (
        <>
          {/**
           * 크레딧 숫자는 **각 열 안**에서 아이콘(저금통·동전·지갑) 바로 위에 둡니다.
           * (예전처럼 위쪽 한 줄로만 두면 `min-h` 큰 열에서 숫자는 맨 위·건물은 맨 아래라 간격이 너무 벌어짐)
           */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[18%] z-[6] flex flex-col items-center sm:bottom-[19%]">
            <div className="grid w-full max-w-[320px] grid-cols-3 items-end gap-x-2 px-1 sm:max-w-[340px] sm:gap-x-3 sm:px-2">
              {/**
               * `min-h`: 왕관 돼지·큰 맵 슬롯까지 감당하고, 맵은 `absolute bottom-0` 으로 세 열 동일선상에 둡니다.
               * `overflow-visible`: 돼지 그림 하단이 잘리지 않게 합니다.
               */}
              <div className="pointer-events-auto relative mx-auto flex min-h-[272px] w-full max-w-[118px] flex-col items-center justify-end justify-self-center overflow-visible sm:min-h-[280px]">
                {/** 은행 맵 — 가운데·오른쪽 열과 같은 슬롯 크기·같은 바닥 */}
                <div className={MISSION_MAP_BACKDROP_SLOT_CLASS} aria-hidden>
                  <Image
                    src={MISSION_CREDIT_MAP_BACKDROP.piggy}
                    alt=""
                    width={200}
                    height={200}
                    className={MISSION_MAP_BACKDROP_IMG_CLASS}
                  />
                </div>
                <div
                  className="pointer-events-none relative z-[2] mb-0.5 flex w-full min-h-[1.25rem] items-center justify-center sm:mb-1"
                  aria-hidden
                >
                  <SlotNumber
                    value={missionCredits.piggy}
                    toneClass="text-sky-900"
                    sizeClass="text-lg sm:text-xl"
                    className="leading-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={missionCredits.onPiggyTap}
                  aria-label={`저금통 크레딧 ${missionCredits.piggy}. 눌러서 옮기기`}
                  className={`relative z-[1] flex flex-col items-center overflow-visible rounded-2xl p-1 transition-transform active:scale-[0.97] ${MISSION_CREDIT_PIG_SPRITE_NUDGE_DOWN_CLASS}`}
                >
                  <div className="flex w-full flex-col items-center overflow-visible">
                    {/**
                     * 초기 단계(핑크 돼지)는 회전 스프라이트·그림자로 아래가 잘려 보이기 쉬워 `min-h`·`pb` 를 넉넉히 둡니다.
                     */}
                    <div
                      className={`relative z-0 flex w-[112px] items-end justify-center overflow-visible pb-3 sm:pb-3.5 ${
                        animatedPiggyIdx >= tallCrownStartIdx
                          ? 'min-h-[228px] pt-5 sm:min-h-[236px] sm:pt-6'
                          : 'min-h-[226px] sm:min-h-[232px]'
                      }`.trim()}
                    >
                      <PiggyBankStageVisual
                        stepIndex={animatedPiggyIdx}
                        displayWidth={64}
                        className={MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS}
                      />
                    </div>
                  </div>
                  {piggySparkleOn ? (
                    <>
                      {piggyLightFx.map((fx, i) => (
                        <span
                          key={`piggy-light-${i}`}
                          className="pointer-events-none absolute -translate-x-1/2 animate-ping"
                          style={{
                            left: `${fx.leftPct}%`,
                            top: `${fx.topPct}%`,
                            animationDuration: `${fx.durationMs}ms`,
                            animationDelay: `${fx.delayMs}ms`,
                            animationIterationCount: 3,
                          }}
                        >
                          <SpriteImage
                            sheet={EFFECT_LIGHTS}
                            frame="lights"
                            width={fx.size}
                            className="select-none"
                            style={{ opacity: fx.opacity }}
                          />
                        </span>
                      ))}
                    </>
                  ) : null}
                </button>
              </div>

              {/** 맵 슬롯을 왼쪽 열과 동일 바닥에 두어, 동전 더미는 그 위(`z-[1]`)에 올립니다. */}
              <div className="pointer-events-auto relative mx-auto flex min-h-[272px] w-full max-w-[118px] flex-col items-center justify-end justify-self-center overflow-visible sm:min-h-[280px]">
                {/** 집 맵: 살짝 위로 + 조금 왼쪽(`-ml`, 가운데 정렬은 유지) */}
                <div
                  className={`${MISSION_MAP_BACKDROP_SLOT_CLASS} -translate-y-2 sm:-translate-y-2.5 -ml-1 sm:-ml-1.5`}
                  aria-hidden
                >
                  <Image
                    src={MISSION_CREDIT_MAP_BACKDROP.floating}
                    alt=""
                    width={200}
                    height={200}
                    className={MISSION_MAP_BACKDROP_IMG_CLASS}
                  />
                </div>
                <div
                  className="pointer-events-none relative z-[2] mb-0.5 flex w-full min-h-[1.25rem] items-center justify-center sm:mb-1"
                  aria-hidden
                >
                  <SlotNumber
                    value={missionCredits.floating}
                    toneClass="text-sky-900"
                    sizeClass="text-lg sm:text-xl"
                    className="leading-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={missionCredits.floating <= 0}
                  onClick={missionCredits.onCenterTap}
                  aria-label={
                    showIslandArt
                      ? `섬에 쌓인 크레딧 ${missionCredits.floating}. 눌러서 지갑이나 저금통으로 옮기기`
                      : `아직 나누지 않은 크레딧 ${missionCredits.floating}. 눌러서 지갑이나 저금통으로 옮기기`
                  }
                  className={`relative z-[1] flex flex-col items-center rounded-2xl px-2 pb-1 pt-0.5 transition-transform active:scale-[0.97] ${MISSION_CREDIT_SPRITE_NUDGE_DOWN_CLASS} ${
                    missionCredits.floating <= 0 ? 'opacity-45' : ''
                  }`}
                >
                  {/**
                   * 가용 크레딧 박스: 단계마다 세로 비율이 달라 `min-h`·`min-w` 를 넉넉히(잘림 방지).
                   */}
                  <div className="relative z-0 flex min-h-[152px] min-w-[88px] items-end justify-center overflow-visible sm:min-h-[160px] sm:min-w-[92px]">
                    <FloatingCreditsStackVisual
                      floating={missionCredits.floating}
                      dimWhenEmpty={false}
                      displayWidth={58}
                      className={MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS}
                    />
                  </div>
                </button>
              </div>

              <div className="pointer-events-auto relative mx-auto flex min-h-[272px] w-full max-w-[118px] flex-col items-center justify-end justify-self-center overflow-visible sm:min-h-[280px]">
                {/** 마켓 맵: 살짝 아래로 (`translate-y`). `scale` 여백용 `overflow-visible` */}
                <div
                  className={`${MISSION_MAP_BACKDROP_SLOT_CLASS} overflow-visible translate-y-2 sm:translate-y-2.5`}
                  aria-hidden
                >
                  <Image
                    src={MISSION_CREDIT_MAP_BACKDROP.wallet}
                    alt=""
                    width={200}
                    height={200}
                    className={MISSION_MAP_BACKDROP_IMG_MARKET_CLASS}
                  />
                </div>
                <div
                  className="pointer-events-none relative z-[2] mb-0.5 flex w-full min-h-[1.25rem] items-center justify-center sm:mb-1"
                  aria-hidden
                >
                  <SlotNumber
                    value={missionCredits.wallet}
                    toneClass="text-sky-900"
                    sizeClass="text-lg sm:text-xl"
                    className="leading-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={missionCredits.onWalletTap}
                  aria-label={`지갑 크레딧 ${missionCredits.wallet}. 눌러서 옮기기`}
                  className={`relative z-[1] flex flex-col items-center rounded-2xl p-1 transition-transform active:scale-[0.97] ${MISSION_CREDIT_WALLET_SPRITE_NUDGE_DOWN_CLASS}`}
                >
                  <div className="relative z-0 flex h-[72px] w-[72px] items-end justify-center overflow-visible sm:h-[76px] sm:w-[76px]">
                    <SpriteImage
                      sheet={ICONS}
                      frame="wallet"
                      width={56}
                      clipRotated={false}
                      className={MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS}
                    />
                  </div>
                </button>
              </div>
            </div>

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
                className="[filter:drop-shadow(0_0_20px_rgba(0,0,0,0.28))_drop-shadow(0_0_10px_rgba(0,0,0,0.22))]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  if (density === 'flex') {
    // `[container-type:size]`: 이 박스가 `cqw`/`cqh` 기준이 되고, 안쪽 transform 의 scale 이 반응형으로 동작함.
    const flexScaleLayerClass =
      scene === 'gippybank' && missionCredits
        ? FLEX_UNIFIED_SCALE_MISSION_CREDITS_CLASS
        : FLEX_UNIFIED_SCALE_CLASS
    /** `container-type` 이 일부 환경에서 자식 페인트를 제한하는 경우를 완화 */
    const flexOuterContainClass =
      scene === 'gippybank' && missionCredits ? 'contain-none [container-type:size]' : '[container-type:size]'
    return (
      <div
        className={`relative mx-auto w-full ${stageMaxClass} ${box} ${flexOuterContainClass} overflow-visible`}
      >
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center overflow-visible">
          <div className={flexScaleLayerClass}>
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
