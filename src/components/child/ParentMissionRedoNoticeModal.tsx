'use client'

/**
 * 부모가 승인 탭에서 완료 미션을 「다시하기」로 되돌렸을 때만 뜨는 안내 팝업입니다.
 *
 * 비개발자 설명:
 * - 아래에 보이는 그림은 **되돌려진 미션 카드와 같은 그림**이에요.
 * - 연속 탭(빨리 여러 번 누르기) 때 나오는 창과는 다르고, **소리는 나지 않아요**.
 */

import { createPortal } from 'react-dom'
import SpriteImage from '@/components/common/SpriteImage'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
import {
  FINISH_MEAL_ROUTINE_PNG_CSS_FILTER,
  isFinishMealRoutinePngUrl,
  resolveRoutineMissionPngUrl,
} from '@/lib/routineMissionThumbnail'
import type { DailyMissionWithTemplate } from '@/types/database'

type Props = {
  /** null 이면 닫힌 상태 — 열릴 때 되돌린 미션 한 건을 넘깁니다 */
  mission: DailyMissionWithTemplate | null
  onClose: () => void
}

export default function ParentMissionRedoNoticeModal({ mission, onClose }: Props) {
  const open = mission != null && mission.missions != null
  if (!open || !mission.missions) return null
  if (typeof window === 'undefined') return null

  const m = mission.missions
  const routineFrame = missionRoutineIconFrame(m.title, m.description)
  const routineImagePath = resolveRoutineMissionPngUrl({
    title: m.title,
    iconEmoji: m.icon_emoji,
    block: m.block,
    difficulty: m.difficulty,
    description: m.description,
  })
  /** 「밥 다 먹기」 PNG 보정 — 자녀 미션 카드와 동일한 필터(살짝 어둡게) */
  const finishMealImageFilter = isFinishMealRoutinePngUrl(routineImagePath)
    ? FINISH_MEAL_ROUTINE_PNG_CSS_FILTER
    : null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${m.title} 미션을 다시 해보자는 안내`}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-4 w-full max-w-xs rounded-3xl bg-white px-6 pb-6 pt-8 shadow-2xl">
        {/* 롤백된 미션과 동일한 썸네일 규칙(전용 PNG 없으면 스프라이트) */}
        <div
          className={[
            'mx-auto mb-4 flex h-[116px] w-[116px] items-center justify-center overflow-hidden rounded-2xl',
          ].join(' ')}
        >
          {routineImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element -- 카드와 동일: public 정적 경로
            <img
              src={routineImagePath}
              alt=""
              className="h-full w-full select-none object-contain"
              style={finishMealImageFilter ? { filter: finishMealImageFilter } : undefined}
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

        <p className="mb-1 text-center text-xs font-bold text-gray-400 line-clamp-2">{m.title}</p>

        <p className="mb-6 text-center text-2xl font-black text-gray-900 leading-snug">다시해보자!</p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-[#4A90E2] py-4 text-base font-black text-white shadow-md transition-opacity active:opacity-80"
        >
          알겠어!
        </button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
