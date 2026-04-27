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
  CHILD_HOME_MISSION_CARD_IMAGE_BOX_CLAMP_CLASS,
  CHILD_HOME_MISSION_CARD_WIDTH_CLAMP_CLASS,
  CHILD_HOME_MISSION_FLUID_VW,
  childHomeMissionRewardIconSizePx,
  childHomeMissionSpriteWidthPx,
  CHILD_TODAY_MISSION_CARD_AM_SHADOW_CLASSNAME,
  CHILD_TODAY_MISSION_CARD_PM_SHADOW_CLASSNAME,
} from '@/lib/missionTodayLayoutSpec'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import type { DailyMissionWithTemplate } from '@/types/database'

type Props = {
  mission: DailyMissionWithTemplate
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
export default function ChildMissionCard({ mission, onComplete }: Props) {
  /** 뷰포트 너비 — 스프라이트·아이콘은 픽셀 지정이 필요해 `clamp` 와 같은 360~900 구간으로 맞춥니다 */
  const [vw, setVw] = useState(
    () =>
      typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
        ? window.innerWidth
        : CHILD_HOME_MISSION_FLUID_VW.minPx,
  )
  useLayoutEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /** 한 카드에 대해 완료 요청을 한 번만 보내기 위한 잠금(연속 탭·중복 호출 방지) */
  const firedRef = useRef(false)
  /** 카드 DOM 참조 — 파티클·컨페티 출발 좌표(getBoundingClientRect) 계산에 사용 */
  const cardRef = useRef<HTMLButtonElement>(null)

  const spriteW = childHomeMissionSpriteWidthPx(vw)
  const rewardIconPx = childHomeMissionRewardIconSizePx(vw)

  const m = mission.missions
  if (!m) return null

  const rewards = scaledMissionRewards(m)
  const special = isSpecialSectionMission(m)
  /** 오후 시간대 미션은 파란 그림자, 그 외(오전·미지정)는 노란 그림자 — 미션 탭과 동일 기준 */
  const timeShadow = isAfternoonMission(mission)
    ? CHILD_TODAY_MISSION_CARD_PM_SHADOW_CLASSNAME
    : CHILD_TODAY_MISSION_CARD_AM_SHADOW_CLASSNAME
  const routineFrame = missionRoutineIconFrame(m.title, m.description)
  const routineImagePath = resolveRoutineMissionPngUrl({ title: m.title, iconEmoji: m.icon_emoji })

  function handleTap() {
    if (firedRef.current) return
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
   * 카드 배경 — 특별 미션은 앰버 테두리, 일반은 연한 테두리(/80 투명도로 배경이 살짝 비침)
   */
  const cardBg = special
    ? 'border-amber-300 bg-gradient-to-b from-amber-50/80 via-amber-100/80 to-yellow-200/80 ring-2 ring-amber-200/60'
    : 'border-[#ede9e0] bg-white/80 backdrop-blur-sm'

  /** 이미지 컨테이너 배경 — 특별 미션은 amber 계열, 일반은 연살구색 */
  const imgBg = special ? 'bg-amber-100' : 'bg-[#FFF0E8]'

  return (
    <div className="relative snap-start shrink-0">
      <button
        ref={cardRef}
        type="button"
        onClick={handleTap}
        aria-label={`${m.title} 미션 완료하기`}
        className={[
          // 모바일 기준 너비 + 뷰포트가 넓어질수록 최대 2배( missionTodayLayoutSpec 의 clamp )
          'flex flex-col items-center gap-[clamp(0.75rem,calc(0.55rem+0.55vw),1.125rem)] rounded-2xl border px-3 pt-4 pb-3 transition-all duration-300 focus:outline-none active:scale-[0.97]',
          CHILD_HOME_MISSION_CARD_WIDTH_CLAMP_CLASS,
          timeShadow,
          cardBg,
        ].join(' ')}
      >
        {/* ── 이미지 컨테이너 — 116px 기준에서 뷰포트에 따라 최대 232px(2×) ── */}
        <div className={['flex shrink-0 items-center justify-center rounded-2xl overflow-hidden', CHILD_HOME_MISSION_CARD_IMAGE_BOX_CLAMP_CLASS, imgBg].join(' ')}>
          {routineImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={routineImagePath}
              alt=""
              className="h-full w-full select-none object-contain"
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

        {/** 부모 루틴·미션 탭과 동일: 크레딧·애정 하트(경험치 별은 카드에 비표시) — `scaledMissionRewards` */}
        <div
          className={[
            'inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-full px-2.5 py-1 font-black tabular-nums tracking-tight text-[#888888] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06] text-[clamp(0.6875rem,calc(0.65rem+0.1vw),0.8125rem)]',
            special ? 'bg-amber-100/90' : 'bg-stone-100/95',
          ].join(' ')}
        >
          <MissionRewardIconTriple
            reward={rewards}
            iconSize={rewardIconPx}
            className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5"
          />
        </div>
      </button>
    </div>
  )
}
