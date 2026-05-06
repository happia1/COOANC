'use client'

/**
 * ChildMissionCard
 *
 * 단일 화면(ChildScreen) 하단에 가로 스크롤로 표시되는 미션 카드.
 * - 탭 한 번으로 완료 (드래그 없음)
 * - 카드 안에서 “완료!” 초록 화면을 보여 주지 않고, 곧바로 목록에서 빠지며
 *   상위(ChildScreen)에서 컨페티·코인 파티클로 축하합니다.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { MissionRewardIconTriple } from '@/components/mission/MissionRewardIconTriple'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
import { resolveRoutineMissionPngUrl } from '@/lib/routineMissionThumbnail'
import { isAfternoonMission } from '@/lib/missionAmPm'
import {
  CHILD_HOME_MISSION_CARD_AM_BG_CLASSNAME,
  CHILD_HOME_MISSION_CARD_PM_BG_CLASSNAME,
  CHILD_HOME_MISSION_CARD_SPECIAL_BG_CLASSNAME,
  CHILD_HOME_MISSION_CARD_SPECIAL_REWARD_PILL_BG_CLASSNAME,
  CHILD_HOME_MISSION_FLUID_VW,
  childHomeMissionRewardIconSizePx,
  childHomeMissionSpriteWidthPx,
} from '@/lib/missionTodayLayoutSpec'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import type { DailyMissionWithTemplate } from '@/types/database'

type Props = {
  mission: DailyMissionWithTemplate
  /**
   * 상위가 올리면(0보다 크면) 탭 1회 잠금을 풉니다.
   * 비개발자: 연속 탭 팝업에서 「미안」 누른 뒤, 같은 카드를 다시 누를 수 있게 할 때 씁니다.
   */
  tapResetKey?: number
  /**
   * 완료 버튼을 눌렀을 때 호출 — 상위에서 API 호출 및 상태 관리를 담당합니다.
   * cardRect: 카드의 화면 위치 (파티클 출발 좌표 계산용)
   * creditReward / heartReward: 파티클 개수 결정용
   */
  onComplete: (
    mission: DailyMissionWithTemplate,
    cardRect: DOMRect,
    creditReward: number,
    heartReward: number,
  ) => void
}

// description 필드는 JSON/알람 데이터를 포함할 수 있어 카드에서 렌더링하지 않습니다.

/**
 * 단일 미션 카드 컴포넌트
 *
 * 비개발자 설명:
 * - 각 미션이 한 장의 카드로 표시됩니다.
 * - 카드를 한 번 탭하면 부모가 처리하는 동안 같은 그림이 잠깐 보이다가 사라집니다(별도 “완료 팝업” 없음).
 */
export default function ChildMissionCard({ mission, onComplete, tapResetKey = 0 }: Props) {
  /**
   * 뷰포트 너비 — 스프라이트·아이콘 픽셀 보간용.
   * SSR 과 첫 클라이언트 페인트는 **같은 값**이어야 하므로 `window` 를 읽지 않고 `minPx` 로 시작한 뒤
   * `useLayoutEffect`에서 실제 너비로 맞춥니다(없으면 하이드레이션 경고 + SpriteImage 스타일 불일치).
   * `CHILD_HOME_MISSION_FLUID_VW`는 `as const`라 `minPx`가 리터럴 360이므로, 그대로 `useState(minPx)`만 쓰면
   * `setVw(window.innerWidth)`에 `number`를 넣을 수 없다는 타입 오류가 납니다 — 초깃값을 `number`로 한 번 맞춥니다.
   */
  const [vw, setVw] = useState<number>(CHILD_HOME_MISSION_FLUID_VW.minPx)
  const [vh, setVh] = useState<number>(CHILD_HOME_MISSION_FLUID_VW.maxPx)
  useLayoutEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /** 한 카드에 대해 완료 요청을 한 번만 보내기 위한 잠금(연속 탭·중복 호출 방지) */
  const firedRef = useRef(false)
  /**
   * 연속 탭 취소 등으로 상위가 tapResetKey 를 올리면 잠금을 풀어 같은 카드를 다시 탭할 수 있게 합니다.
   * 비개발자: 숫자가 바뀌면 "이 카드, 다시 한 번 눌러도 돼" 신호로 받아들이면 됩니다.
   */
  useLayoutEffect(() => {
    if (tapResetKey > 0) {
      firedRef.current = false
    }
  }, [tapResetKey])
  /** 카드 DOM 참조 — 파티클·컨페티 출발 좌표(getBoundingClientRect) 계산에 사용 */
  const cardRef = useRef<HTMLButtonElement>(null)

  /**
   * 모바일에서만 카드 크기를 확대합니다.
   * - 360px 이하: 1배
   * - 430px 이상(모바일 구간): 최대 1.3배
   * - 768px 이상에서도 1.3배를 유지해 경계에서 갑자기 작아지지 않게 합니다.
   */
  const mobileScaleBaseW = CHILD_HOME_MISSION_FLUID_VW.minPx
  const mobileScaleFullW = 430
  const mobileScaleMax = 1.3
  const mobileCardScale =
    vw >= 768
      ? mobileScaleMax
      : vw <= mobileScaleBaseW
        ? 1
        : vw >= mobileScaleFullW
          ? mobileScaleMax
          : 1 + ((vw - mobileScaleBaseW) * (mobileScaleMax - 1)) / (mobileScaleFullW - mobileScaleBaseW)

  /**
   * 태블릿 세로형(가로 768px 이상 + 세로가 더 긴 화면)에서 카드가 작아 보이지 않도록
   * 추가 배율을 살짝 얹습니다.
   */
  const isTallTablet = vw >= 768 && vw <= 1200 && vh / Math.max(vw, 1) >= 1.25
  const tabletPortraitBoost = isTallTablet ? 1.1 : 1
  const finalCardScale = mobileCardScale * tabletPortraitBoost

  const baseCardWidthPx = 150
  const baseImageBoxPx = 116
  const baseSpriteW = Math.round(childHomeMissionSpriteWidthPx(CHILD_HOME_MISSION_FLUID_VW.minPx))
  const baseRewardIconPx = Math.round(childHomeMissionRewardIconSizePx(CHILD_HOME_MISSION_FLUID_VW.minPx))

  const cardWidthPx = Math.round(baseCardWidthPx * finalCardScale)
  const imageBoxPx = Math.round(baseImageBoxPx * finalCardScale)
  const spriteW = Math.round(baseSpriteW * finalCardScale)
  const rewardIconPx = Math.round(baseRewardIconPx * finalCardScale)

  const m = mission.missions
  if (!m) return null

  const rewards = scaledMissionRewards(m)
  const special = isSpecialSectionMission(m)
  const routineFrame = missionRoutineIconFrame(m.title, m.description)
  const routineImagePath = resolveRoutineMissionPngUrl({
    title: m.title,
    iconEmoji: m.icon_emoji,
    block: m.block,
    description: m.description,
  })
  /** 비개발자: 저녁밥먹기 카드 이미지일 때만 아래로 아주 살짝 내리기 위한 조건입니다. */
  const isDinnerMissionImage = routineImagePath?.includes('dinner.png') ?? false
  /** 「밥 다 먹기」 PNG 는 그림이 상대적으로 어두워 보여, 카드에서는 밝기를 조금 올려 보정합니다 */
  const brightPng = routineImagePath?.includes('clean_up_all.png') ? 'brightness(1.24) saturate(1.06)' : null

  function handleTap() {
    if (firedRef.current) {
      return
    }
    firedRef.current = true

    /** 카드 위치를 부모로 전달해 파티클·컨페티 출발 좌표를 계산합니다 */
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      onComplete(mission, rect, rewards.credit, rewards.heart)
    } else {
      onComplete(mission, new DOMRect(), rewards.credit, rewards.heart)
    }
  }

  /**
   * 카드 배경 — 스페셜은 골드(`missionTodayLayoutSpec`), 일상은 오전 분홍 / 오후 파랑(`missionAmPm` 와 동일 기준).
   */
  const cardBg = special
    ? CHILD_HOME_MISSION_CARD_SPECIAL_BG_CLASSNAME
    : isAfternoonMission(mission)
      ? CHILD_HOME_MISSION_CARD_PM_BG_CLASSNAME
      : CHILD_HOME_MISSION_CARD_AM_BG_CLASSNAME

  /** 보상 알약·아이콘 행 클래스 — 스페셜은 골드 알약 전용 클래스(링은 CSS에서 처리) */
  const rewardPillClassName = [
    '-mt-1.5 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full px-4 py-1 font-black tabular-nums tracking-tight text-[#888888] text-[clamp(0.8125rem,calc(0.75rem+0.14vw),1rem)]',
    special
      ? CHILD_HOME_MISSION_CARD_SPECIAL_REWARD_PILL_BG_CLASSNAME
      : 'bg-stone-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06]',
  ].join(' ')
  const rewardTripleClassName =
    'flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5'

  return (
    <div className="relative snap-start shrink-0">
      <button
        ref={cardRef}
        type="button"
        onClick={handleTap}
        aria-label={`${m.title} 미션 완료하기`}
        className={[
          // 스페셜은 `.child-mission-card-gold` 안에서 테두리까지 그리므로 공통 `border` 를 빼 색이 덮이지 않게 함
          'flex flex-col items-center gap-[clamp(0.75rem,calc(0.55rem+0.55vw),1.125rem)] rounded-2xl px-3 pt-4 pb-3 transition-all duration-300 focus:outline-none active:scale-[0.97]',
          special ? '' : 'border',
          cardBg,
        ].join(' ')}
        style={{ width: `${cardWidthPx}px` }}
      >
        {/**
         * 이미지 컨테이너 — 치수만 잡고 배경색은 두지 않음(카드 본문 배경이 그대로 비침).
         * 비개발자: 예전 연한 주황/노란 “액자” 칠을 없애고 일러스트만 떠 있게 한 것입니다.
         */}
        <div
          className={[
            'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl',
          ].join(' ')}
          style={{ width: `${imageBoxPx}px`, height: `${imageBoxPx}px` }}
        >
          {routineImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={routineImagePath}
              alt=""
              className={['h-full w-full select-none object-contain', isDinnerMissionImage ? 'translate-y-1' : '']
                .filter(Boolean)
                .join(' ')}
              style={brightPng ? { filter: brightPng } : undefined}
              draggable={false}
            />
          ) : (
            <SpriteImage
              sheet={MISSION_ROUTINES_ATLAS}
              frame={routineFrame}
              width={spriteW}
              clipRotated={false}
              className="select-none"
            />
          )}
        </div>

        {/* ── 미션명 (한 줄 고정) ── */}
        <p className="w-full text-center font-bold leading-snug text-gray-800 line-clamp-1 text-[clamp(0.875rem,calc(0.8rem+0.15vw),1.0625rem)]">
          {m.title}
        </p>

        {/**
         * 크레딧·하트 알약 — 가로·글자·아이콘은 유지하고 세로는 `py-1` 로 더 낮춤.
         * `-mt-1.5`: 제목과 알약 사이를 조금 더 좁혀 칩을 위로 당깁니다.
         */}
        <div className={rewardPillClassName}>
          <MissionRewardIconTriple
            reward={rewards}
            iconSize={rewardIconPx}
            className={rewardTripleClassName}
          />
        </div>
      </button>
    </div>
  )
}
