'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'
import { resolveHomeIslandStageSprite, type HomeIslandStageSprite } from '@/lib/childHomeCharacterFromAvatar'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import { MISSION_CREDITS_STAGE_CAP, piggyBankStageCount } from '@/constants/piggyBankStages'
import { EFFECT_LIGHTS } from '@/constants/sprites'
import { walletImageSrcByStage, walletStageIndexByCredits } from '@/lib/walletStages'
type LightFx = { leftPct: number; topPct: number; size: number; delayMs: number; durationMs: number; opacity: number }

/**
 * 홈·미션 공통: 섬을 카드 쪽으로 당김 (`default`·`viewportFit`).
 */
const LIFT_CLASS = '-translate-y-[9rem] sm:-translate-y-[12rem]'

/**
 * Tailwind 가 빌드 시 인식하도록 **문자열 리터럴**만 사용.
 * `320×280` 기준 캔버스에 섬·토끼·돼지를 두고, `cqw`/`cqh` 로 **한 번에** 축소·확대(최소 0.38 ~ 최대 1.18).
 */
/**
 * 홈 flex 무대: 섬·잔디·캐릭터를 아래쪽에 두되, 위로 너무 끌어올리지 않도록 `translateY` 상한을 조금 줄입니다.
 * (숫자를 키우면 다시 위로 붙어 보입니다. 한 칸 더 내릴 때는 rem/cqh 를 함께 소폭 낮춥니다.)
 */
const FLEX_UNIFIED_SCALE_CLASS =
  'pointer-events-none absolute bottom-0 left-1/2 h-[280px] w-[320px] max-w-full origin-bottom overflow-visible [transform:translateX(-50%)_translateY(calc(-1*min(7rem,16cqh)))_scale(clamp(0.38,min(1.18,calc(100cqw/320px),calc(100cqh/280px)),1.18))]'

/**
 * 미션(저금통·지갑 UI): 왕관 등 키 큰 스프라이트가 280px 캔버스 위로 넘칠 수 있어
 * 논리 높이만 320px 로 키우고, cqh 기준도 320에 맞춥니다(홈 토끼 경로는 위 상수 유지).
 *
 * 리사이즈 중간 구간(특히 세로가 애매한 높이)에서 숫자 슬롯·맵 배경이 일부 잘리는 현상을 줄이기 위해:
 * - 위로 끌어올리는 값(`translateY`)을 완화
 * - 최대 확대 배율을 약간 낮춤
 * 이렇게 하면 특정 구간에서만 과확대되어 컨테이너 상단/하단이 잘리는 문제를 완화할 수 있습니다.
 */
const FLEX_UNIFIED_SCALE_MISSION_CREDITS_CLASS =
  'pointer-events-none absolute bottom-0 left-1/2 h-[320px] w-[320px] max-w-full origin-bottom overflow-visible [transform:translateX(-50%)_translateY(calc(-1*min(9.5rem,20cqh)))_scale(clamp(0.38,min(1.22,calc(100cqw/320px),calc(100cqh/320px)),1.22))]'

/** 기본 무대 박스 — 고정 비율(스크롤이 생기기 쉬움). */
const BOX_DEFAULT = 'h-[min(46dvh,400px)] min-h-[280px]'
/** 예전 한 화면 실험용 — 매우 낮은 박스. */
const BOX_VIEWPORT_FIT = 'h-[min(17dvh,148px)] min-h-[96px] max-h-[24vh]'
/**
 * 플렉스 열에 넣을 때: 위쪽 풍경 안에서 **남는 높이**만 씀.
 * - `sm:` 별도 max-h 분기 없음 → 리사이즈 시 % 배치가 덜 튐.
 * - 그리드 `min-h` 는 **컨테이너(`cqh`)보다 크면** 위로 밀려 상위 `overflow-hidden` 에 잘려 아이콘이 「사라짐」 → `min(…, …cqh)` 로 맞춤.
 */
const BOX_FLEX =
  'w-full flex-1 basis-0 min-h-[64px] max-h-[min(46dvh,380px)] overflow-visible'

const ISLAND_IMAGE_SRC = {
  bunny: '/assets/img/layouts/backgrounds/kids_background_island.png',
  gippybank: '/assets/img/layouts/backgrounds/kids_background_island_gippybank.png',
} as const

/**
 * 미션 탭: 예전에는 열마다 은행·집·마켓 PNG 를 깔았고, 지금은 **한 장**의 맵만 씁니다.
 * 파일 위치: `public/assets/img/games/map/map.png` → 브라우저 경로는 `/assets/...` 로 시작합니다.
 */
const MISSION_MAP_UNIFIED_SRC = '/assets/img/games/map/map.png'

/**
 * 맵 PNG(뒤): 요청사항에 맞춰 흐림(blur) 효과를 제거하고 기본 선명도로 표시합니다.
 */
const MISSION_MAP_BACKDROP_SOFTEN_CLASS = ''

/**
 * 3열 그리드 전체 너비 안에서 맵을 **가로·세로 가운데(아래쪽 기준)** 에 맞춥니다.
 * `object-contain`: 맵 비율을 유지한 채 박스 안에 들어가게 합니다.
 * 비개발자용 설명:
 * - 이전 `w-full`은 부모 가로폭에 딱 맞아 높이만 바꿔도 변화가 거의 안 보일 수 있었어요.
 * - `w-[124%]`로 맵 자체 폭을 키워 실제 화면에서 확대/축소 변화가 바로 보이게 합니다.
 */
const MISSION_MAP_UNIFIED_IMG_CLASS = `h-full w-[110%] max-w-none max-h-[13rem] select-none object-contain object-bottom ${MISSION_MAP_BACKDROP_SOFTEN_CLASS}`

/**
 * 돼지·크레딧 더미·지갑 — 위치는 밀지 않고(오프셋 0), **주변으로만 번지는** 그림자.
 * `drop-shadow(dx dy blur)` 에서 dx·dy 를 0으로 두고 blur 만 여러 겹 겹칩니다.
 */
const MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS =
  '[filter:drop-shadow(0_0_22px_rgba(15,23,42,0))_drop-shadow(0_0_12px_rgba(15,23,42,0))_drop-shadow(0_0_6px_rgba(0,0,0,0.32))]'

/** 가운데 가용 크레딧 더미만 — 요청사항에 맞춰 한 단계 더 아래 */
const MISSION_CREDIT_SPRITE_NUDGE_DOWN_CLASS = 'translate-y-10'

/**
 * 지갑 위치:
 * - `translate-y-19` 같은 값은 Tailwind 기본 스케일에 없어 클래스가 무시될 수 있습니다.
 * - 그래서 미세 조정이 필요할 때는 `translate-y-[...]`(arbitrary value)로 고정합니다.
 */
const MISSION_CREDIT_WALLET_SPRITE_NUDGE_DOWN_CLASS = '-translate-x-4 translate-y-[3.6rem]'

/** 저금통(돼지): 미세 조정이 쉽도록 동일하게 arbitrary value 사용 */
const MISSION_CREDIT_PIG_SPRITE_NUDGE_DOWN_CLASS = 'translate-x-4 translate-y-[5rem]'

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

/** 미션 무대(지도 위): 저금통(왼쪽)·지갑(오른쪽)·가운데 돈바구니(가용 동전) — 탭하면 옮기기 시트가 뜹니다 */
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
    return (
      <span className={`inline-flex h-[1.15em] items-center justify-center ${sizeClass} leading-none`}>,</span>
    )
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

  /**
   * 표시 문자열: `toLocaleString('ko-KR')` 의 천 단위 쉼표(예: 1,240)는 슬롯이 넓어져 잘리기 쉬워 제외하고,
   * 숫자만 한 글자씩 나눕니다(예: 1240 → '1','2','4','0').
   */
  const chars = useMemo(() => String(displayed).split(''), [displayed])

  return (
    <span className={`${className} inline-flex items-center gap-[0.04em] font-black tabular-nums ${toneClass}`}>
      {chars.map((ch, idx) => (
        /**
         * 요청사항:
         * - 슬롯머신처럼 움직이는 각 자리(숫자; 필요 시 쉼표도 `SlotDigit` 에서 처리) 뒤에 흰색 네모 블록을 깔아
         *   자리 구분이 또렷하게 보이도록 합니다.
         */
        <span
          key={`digit-${idx}-${ch}`}
          className="inline-flex min-w-[0.9em] items-center justify-center rounded-[0.22em] border border-white/90 bg-white/95 px-[0.14em] py-[0.06em] shadow-[0_1px_2px_rgba(15,23,42,0.18)]"
        >
          <SlotDigit digit={ch} sizeClass={sizeClass} />
        </span>
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
  /** 지갑·저금통·돈바구니(가용) 분리 UI — 있으면 `missionPiggy` 단일 저금통은 숨깁니다 */
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
    /** 수달: `resolveHomeIslandStageSprite` 가 `character: 'otter'` 를 넘길 때 — 분기 없으면 화면에 아무것도 안 그려짐 */
    case 'otter':
      return (
        <CharacterSprite character="otter" frame={sprite.frame} width={sprite.width} height={sprite.height} className={cls} />
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
  /** 미션은 부모(`max-w-sm`) 너비를 쓰면 저금통·돈바구니(가운데)가 좌우로 덜 잘림 */
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
  /**
   * 지갑도 목표 단계까지 한 칸씩 따라가게 해서
   * 크레딧/저금통처럼 서서히 바뀌는 느낌을 맞춥니다.
   */
  const walletTargetIdx =
    scene === 'gippybank' && missionCredits ? walletStageIndexByCredits(missionCredits.wallet) : 0
  const [animatedWalletIdx, setAnimatedWalletIdx] = useState(walletTargetIdx)
  const animatedWalletIdxRef = useRef(animatedWalletIdx)

  /** 9단계 중 마지막 두 칸은 왕관 돼지(343) — 위로 길어 `min-h`·`pt` 로 잘림을 줄입니다. */
  const piggyStageCount = piggyBankStageCount()
  const tallCrownStartIdx = Math.max(0, piggyStageCount - 2)

  useEffect(() => {
    animatedPiggyIdxRef.current = animatedPiggyIdx
  }, [animatedPiggyIdx])

  useEffect(() => {
    animatedWalletIdxRef.current = animatedWalletIdx
  }, [animatedWalletIdx])

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

  useEffect(() => {
    if (walletTargetIdx === animatedWalletIdxRef.current) return
    /** 지갑도 목표 단계까지 한 칸씩 이동해 급격한 점프를 줄입니다. */
    const tick = setInterval(() => {
      setAnimatedWalletIdx((prev) => {
        if (prev === walletTargetIdx) return prev
        return prev + (walletTargetIdx > prev ? 1 : -1)
      })
    }, 160)
    return () => clearInterval(tick)
  }, [walletTargetIdx])

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
        <div
          /**
           * 작은 화면에서 캐릭터를 살짝 아래로 내려 답답해 보이는 느낌을 줄입니다.
           * - 기본(작은 화면): bottom 24%
           * - sm 이상: 기존처럼 bottom 30%
           */
          /**
           * 요청사항:
           * - 모바일에서는 캐릭터를 한참 아래로 내려 배치합니다.
           * - 패드 가로(`md:landscape`)에서는 캐릭터를 더 위로 올립니다.
           */
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-[14%] z-[2] flex justify-center sm:bottom-[34%] md:landscape:bottom-[42%]"
        >
          {density === 'flex' ? (
            <div
              role="img"
              aria-label="나의 쿠앵이 캐릭터"
              /**
               * 요청사항 반영:
               * - 현재 캐릭터 크기를 3분의 2(약 66.7%)로 줄입니다.
               * - 태블릿 가로도 같은 비율로 함께 축소합니다.
               */
              className="origin-bottom [transform:scale(1)] md:landscape:[transform:scale(1.27)]"
            >
              <HomeIslandHeroSprite sprite={homeStageSprite} />
            </div>
          ) : (
            /**
             * 비-flex: 캐릭터만 뷰포트 너비 기준으로 살짝 키움/줄임(섬과 따로 놀지 않게 이미 상한을 둠).
             * 세로도 `clamp` 로 바꿔 화면 크기에 따라 부드럽게 따라가게 해서 러그 기준 이탈을 줄입니다.
             */
            <div
              role="img"
              aria-label="나의 쿠앵이 캐릭터"
              className="origin-bottom [transform:translateY(clamp(2.2rem,8.8vh,3.9rem))_scale(calc(clamp(0.72,calc(min(100vw,20rem)/300),1.08)*0.9))]"
            >
              <HomeIslandHeroSprite sprite={homeStageSprite} />
            </div>
          )}
        </div>
      ) : null}

      {scene === 'gippybank' && missionCredits ? (
        <>
          {/**
           * 크레딧 숫자는 **한 줄 그리드**로만 두고, 무대 위쪽에 고정합니다.
           * 예전 `sm:top-[45%]` 는 넓은 화면에서만 숫자가 한가운데로 떨어져 맵·건물과 겹쳤습니다 → **모든 너비에서 동일 %** 유지.
           */}
          <div className="pointer-events-none absolute inset-0 z-[6]">
            {/**
             * `top-[11%]` + `-translate-y-1/2`: 숫자 줄 중심이 무대 상단 근처에만 오도록(모바일·sm 동일).
             * `items-end`: 한 자리·두 자리 숫자도 **밑변**을 맞춤.
             */}
            <div className="pointer-events-none absolute inset-x-0 top-[11%] z-[7] flex -translate-y-1/2 justify-center">
              <div className="grid w-full max-w-[320px] grid-cols-3 items-end justify-items-center gap-x-2 px-1 sm:max-w-[340px] sm:gap-x-3 sm:px-2">
                <div className="flex min-h-[1.35em] w-full items-end justify-center" aria-hidden>
                  <SlotNumber
                    value={missionCredits.piggy}
                    toneClass="text-sky-900"
                    sizeClass="text-lg"
                    className="leading-none"
                  />
                </div>
                <div className="flex min-h-[1.35em] w-full items-end justify-center" aria-hidden>
                  <SlotNumber
                    value={missionCredits.floating}
                    toneClass="text-sky-900"
                    sizeClass="text-lg"
                    className="leading-none"
                  />
                </div>
                <div className="flex min-h-[1.35em] w-full items-end justify-center" aria-hidden>
                  <SlotNumber
                    value={missionCredits.wallet}
                    toneClass="text-sky-900"
                    sizeClass="text-lg"
                    className="leading-none"
                  />
                </div>
              </div>
            </div>
            {/**
             * 통합 맵은 `absolute` 로 3열 가로 한가운데, 돼지·동전·지갑은 `z-[1]` 로 그 위.
             */}
            {/**
             * `bottom-[26%]`: 맵·아이콘 덩어리를 무대 안쪽으로 두고, 열 `min-h` 는 `cqh` 상한으로 잘림 방지.
             */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[26%] flex flex-col items-center">
              <div className="relative grid w-full max-w-[320px] grid-cols-3 items-end gap-x-2 px-0 sm:max-w-[340px] sm:gap-x-3 sm:px-0">
              {/**
               * `map.png` 한 장 — 3열 그리드 안 `absolute` 슬롯.
               * `bottom-0` 대신 `bottom-2` 등: 그리드 **바닥에서 띄운 만큼** 맵 전체가 위로 올라감(돼지·지갑은 그대로).
               */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-2 z-0 flex h-[12rem] items-end justify-center sm:bottom-2 sm:h-[12.5rem]"
                aria-hidden
              >
                <Image
                  src={MISSION_MAP_UNIFIED_SRC}
                  alt=""
                  width={640}
                  height={360}
                  className={MISSION_MAP_UNIFIED_IMG_CLASS}
                  priority={scene === 'gippybank'}
                />
              </div>
              {/**
               * `min-h`: 왕관 돼지 등 키 큰 스프라이트까지 세로로 감당합니다.
               * `overflow-visible`: 돼지 그림 하단이 잘리지 않게 합니다.
               */}
              {/** `min-h` 를 `cqh` 로 상한 — 짧은 무대에서 272px 고정이면 전부 클리핑되어 아이콘이 안 보임 */}
              <div className="pointer-events-auto relative z-[1] mx-auto flex min-h-[min(17rem,72cqh)] w-full max-w-[118px] flex-col items-center justify-end justify-self-center overflow-visible sm:min-h-[min(17.5rem,76cqh)]">
                <button
                  type="button"
                  onClick={missionCredits.onPiggyTap}
                  aria-label={`저금통 크레딧 ${missionCredits.piggy}. 눌러서 옮기기`}
                  className={`relative z-[1] flex flex-col items-center overflow-visible rounded-2xl p-1 transition-transform active:scale-[0.97] ${MISSION_CREDIT_PIG_SPRITE_NUDGE_DOWN_CLASS}`}
                >
                  <div className="flex w-full flex-col items-center overflow-visible">
                    {/**
                     * 돼지 스프라이트 영역도 무대 높이에 맞춰 상한(`cqh`) — 잘림 방지.
                     */}
                    <div
                      className={`relative z-0 flex w-[112px] max-h-[min(15rem,58cqh)] items-end justify-center overflow-visible pb-2 sm:pb-2.5 ${
                        animatedPiggyIdx >= tallCrownStartIdx
                          ? 'min-h-[min(13.5rem,52cqh)] pt-3 sm:min-h-[min(14rem,54cqh)] sm:pt-4'
                          : 'min-h-[min(13.25rem,50cqh)] sm:min-h-[min(13.5rem,52cqh)]'
                      }`.trim()}
                    >
                      <PiggyBankStageVisual
                        stepIndex={animatedPiggyIdx}
                        displayWidth={64}
                        piggyCredits={missionCredits.piggy}
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

              {/** 가운데 열: 통합 맵은 그리드 공통 레이어에서 이미 깔림 */}
              <div className="pointer-events-auto relative z-[1] mx-auto flex min-h-[min(17rem,72cqh)] w-full max-w-[118px] flex-col items-center justify-end justify-self-center overflow-visible sm:min-h-[min(17.5rem,76cqh)]">
                <button
                  type="button"
                  disabled={missionCredits.floating <= 0}
                  onClick={missionCredits.onCenterTap}
                  aria-label={
                    showIslandArt
                      ? `돈바구니에 쌓인 크레딧 ${missionCredits.floating}. 눌러서 지갑이나 저금통으로 옮기기`
                      : `아직 나누지 않은 크레딧 ${missionCredits.floating}. 눌러서 지갑이나 저금통으로 옮기기`
                  }
                  className={`relative z-[1] flex flex-col items-center rounded-2xl px-2 pb-1 pt-0.5 transition-transform active:scale-[0.97] ${MISSION_CREDIT_SPRITE_NUDGE_DOWN_CLASS} ${
                    missionCredits.floating <= 0 ? 'opacity-45' : ''
                  }`}
                >
                  {/**
                   * 가용 크레딧 박스: 단계마다 세로 비율이 달라 `min-h`·`min-w` 를 넉넉히(잘림 방지).
                   */}
                  <div className="relative z-0 flex min-h-[min(8.5rem,34cqh)] min-w-[88px] items-end justify-center overflow-visible sm:min-h-[min(9rem,36cqh)] sm:min-w-[92px]">
                    <FloatingCreditsStackVisual
                      floating={missionCredits.floating}
                      dimWhenEmpty={false}
                      /** 요청사항: 가운데 크레딧 이미지를 한 단계 더 크게 표시 */
                      displayWidth={100}
                      className={MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS}
                    />
                  </div>
                </button>
              </div>

              <div className="pointer-events-auto relative z-[1] mx-auto flex min-h-[min(17rem,72cqh)] w-full max-w-[118px] flex-col items-center justify-end justify-self-center overflow-visible sm:min-h-[min(17.5rem,76cqh)]">
                <button
                  type="button"
                  onClick={missionCredits.onWalletTap}
                  aria-label={`지갑 크레딧 ${missionCredits.wallet}. 눌러서 옮기기`}
                  className={`relative z-[1] flex flex-col items-center rounded-2xl p-1 transition-transform active:scale-[0.97] ${MISSION_CREDIT_WALLET_SPRITE_NUDGE_DOWN_CLASS}`}
                >
                  <div className="relative z-0 flex h-[92px] w-[92px] items-end justify-center overflow-visible sm:h-[96px] sm:w-[96px]">
                    <Image
                      src={walletImageSrcByStage(animatedWalletIdx)}
                      alt=""
                      width={74}
                      height={74}
                      className={`select-none object-contain ${MISSION_CREDIT_SPRITE_POP_SHADOW_CLASS}`}
                      draggable={false}
                    />
                  </div>
                </button>
              </div>
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
      <div className={`relative mx-auto w-full ${stageMaxClass} ${box} ${flexOuterContainClass} overflow-visible`}>
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
