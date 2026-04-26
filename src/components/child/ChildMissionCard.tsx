'use client'

/**
 * ChildMissionCard
 *
 * 단일 화면(ChildScreen) 하단에 가로 스크롤로 표시되는 미션 카드.
 * - 탭 한 번으로 완료 (드래그 없음)
 * - 완료 시 초록 배경 + 체크 애니메이션
 * - +크레딧 플로팅 숫자 애니메이션
 */

import { useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
import { resolveRoutineMissionPngUrl } from '@/lib/routineMissionThumbnail'
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
 * - 카드를 탭하면 미션을 완료로 표시하고 초록색으로 바뀝니다.
 * - 완료 후 잠깐 "+크레딧" 숫자가 떠오르는 효과가 나옵니다.
 */
export default function ChildMissionCard({ mission, onComplete }: Props) {
  /** 완료 애니메이션 진행 중 여부 */
  const [completing, setCompleting] = useState(false)
  /** +크레딧 플로팅 숫자 표시 여부 */
  const [showFloat, setShowFloat] = useState(false)
  /** 카드 DOM 참조 — 파티클 출발 좌표(getBoundingClientRect) 계산에 사용 */
  const cardRef = useRef<HTMLButtonElement>(null)

  const m = mission.missions
  if (!m) return null

  const rewards = scaledMissionRewards(m)
  const special = isSpecialSectionMission(m)
  const routineFrame = missionRoutineIconFrame(m.title, m.description)
  const routineImagePath = resolveRoutineMissionPngUrl({ title: m.title, iconEmoji: m.icon_emoji })

  function handleTap() {
    if (completing) return
    setCompleting(true)
    setShowFloat(true)

    /** 카드 위치를 부모로 전달해 파티클 출발 좌표를 계산합니다 */
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      onComplete(mission, rect, rewards.credit, rewards.heart)
    } else {
      onComplete(mission, new DOMRect(), rewards.credit, rewards.heart)
    }

    setTimeout(() => setShowFloat(false), 1400)
  }

  /**
   * 완료 여부에 따른 카드 배경 색상 클래스
   * — 모든 상태에서 /80 투명도를 적용해 배경 이미지가 살짝 비쳐 보이도록 합니다.
   */
  const cardBg = completing
    ? 'border-green-400 bg-gradient-to-b from-green-100/80 to-green-200/80'
    : special
      ? 'border-amber-300 bg-gradient-to-b from-amber-50/80 via-amber-100/80 to-yellow-200/80 ring-2 ring-amber-200/60'
      : 'border-[#ede9e0] bg-white/80 backdrop-blur-sm'

  /** 이미지 컨테이너 배경 — 특별 미션은 amber 계열, 일반은 연살구색 */
  const imgBg = completing
    ? 'bg-green-100'
    : special
      ? 'bg-amber-100'
      : 'bg-[#FFF0E8]'

  return (
    <div className="relative snap-start shrink-0">
      {/* +크레딧 플로팅 숫자 */}
      {showFloat && (
        <div
          className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 animate-[fadeUp_1.2s_ease-out_forwards] text-sm font-black text-yellow-500 drop-shadow-sm"
          aria-hidden
        >
          +{rewards.credit}🪙
        </div>
      )}

      <button
        ref={cardRef}
        type="button"
        onClick={handleTap}
        disabled={completing}
        aria-label={`${m.title} 미션 완료하기`}
        /** completing 상태가 되면 cardComplete 애니메이션으로 카드가 살짝 커졌다 사라집니다 */
        style={completing ? { animation: 'cardComplete 0.25s ease-in forwards' } : undefined}
        className={[
          'flex w-[150px] flex-col items-center gap-3 rounded-2xl border px-3 pt-4 pb-3 shadow-sm transition-all duration-300 focus:outline-none active:scale-[0.97]',
          cardBg,
        ].join(' ')}
      >
        {/* ── 이미지 컨테이너 116×116px ── */}
        <div className={[
          'flex h-[116px] w-[116px] shrink-0 items-center justify-center rounded-2xl overflow-hidden',
          imgBg,
        ].join(' ')}>
          {completing ? (
            <span className="animate-[popIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards] text-5xl">✅</span>
          ) : routineImagePath ? (
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
              width={108}
              clipRotated={false}
              className="select-none"
            />
          )}
        </div>

        {/* ── 미션명 (한 줄 고정) ── */}
        <p className="w-full text-center text-sm font-bold leading-snug text-gray-800 line-clamp-1">
          {completing ? <span className="text-green-700">완료! 🎉</span> : m.title}
        </p>

        {/* ── 보상 알약 (스프라이트 아이콘 + 숫자) ── */}
        <div
          className={[
            'inline-flex max-w-full flex-nowrap items-center justify-center gap-x-1.5 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums tracking-tight text-[#888888] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06]',
            completing
              ? 'bg-green-100/90'
              : special
                ? 'bg-amber-100/90'
                : 'bg-stone-100/95',
          ].join(' ')}
        >
          <span className="inline-flex items-center gap-[3px]">
            <SpriteImage
              sheet={ICONS}
              frame="credit"
              width={13}
              clipRotated={false}
              className="shrink-0 select-none"
            />
            <span>{rewards.credit}</span>
          </span>
          <span className="inline-flex items-center gap-[3px]" title="하트">
            <SpriteImage
              sheet={ICONS}
              frame="heart"
              width={13}
              className="shrink-0 select-none"
            />
            <span>{rewards.heart}</span>
          </span>
        </div>
      </button>
    </div>
  )
}
