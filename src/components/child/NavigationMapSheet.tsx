'use client'

import ChildBottomSheetShell from '@/components/child/ChildBottomSheetShell'
import { NAV_MAP_SECTIONS, STEPS_PER_SECTION } from '@/constants/navigationMap'
import type { ChildStats } from '@/types/database'

const SHEET_TITLE_ID = 'navigation-map-sheet-title'

interface NavigationMapSheetProps {
  open: boolean
  onClose: () => void
  childName: string
  stats: ChildStats | null
  childAge?: number | null
}

function HeartStep({ filled, isBoat }: { filled: boolean; isBoat: boolean }) {
  if (isBoat) {
    return (
      <span className="boat-advance inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-blue-300 text-base">
        🚢
      </span>
    )
  }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${filled ? 'bg-pink-200 text-pink-600' : 'bg-gray-100 text-gray-300'}`}>
      {filled ? '❤️' : '🤍'}
    </span>
  )
}

export default function NavigationMapSheet({
  open,
  onClose,
  childName,
  stats,
  childAge,
}: NavigationMapSheetProps) {
  const boatSection = stats?.boat_section ?? 0
  const boatStep = stats?.boat_step ?? 0
  const currentLevel = stats?.current_level ?? 0

  return (
    <ChildBottomSheetShell open={open} onClose={onClose} titleId={SHEET_TITLE_ID}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-6">
        {/* 헤더 */}
        <div className="mb-4 mt-1 flex shrink-0 items-center justify-between">
          <h2 id={SHEET_TITLE_ID} className="text-lg font-black text-brand-text">
            🗺️ 항해지도
          </h2>
          <p className="text-xs text-gray-400">{childName}의 항해</p>
        </div>

        {/* 섹션 목록 */}
        <div className="flex flex-col gap-3">
          {NAV_MAP_SECTIONS.map((section) => {
            const isUnlocked = currentLevel >= section.minLevel
            const isCurrentSection = isUnlocked && boatSection === section.index
            const isPastSection = isUnlocked && boatSection > section.index

            return (
              <div
                key={section.index}
                className={`relative rounded-2xl border-2 p-4 transition-all ${
                  isCurrentSection
                    ? 'border-blue-300 shadow-md'
                    : isPastSection
                      ? 'border-green-200 opacity-80'
                      : isUnlocked
                        ? 'border-gray-200'
                        : 'border-gray-100 opacity-50'
                }`}
                style={{ backgroundColor: section.color }}
              >
                {/* 섹션 헤더 */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{section.emoji}</span>
                    <div>
                      <p className="text-sm font-black" style={{ color: section.accentColor }}>
                        {section.name}
                      </p>
                      <p className="text-[10px] text-gray-500">{section.subtitle}</p>
                    </div>
                  </div>
                  {!isUnlocked && (
                    <div className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5">
                      <span className="text-[10px] text-gray-500">🔒 Lv.{section.minLevel}</span>
                    </div>
                  )}
                  {isPastSection && (
                    <span className="text-[10px] font-bold text-green-600">완항 ✓</span>
                  )}
                  {isCurrentSection && (
                    <span className="text-[10px] font-bold text-blue-600">항해 중</span>
                  )}
                </div>

                {/* 배 이동 경로 */}
                {isUnlocked && (
                  <div className="flex items-center gap-2">
                    {/* 출발 등대 */}
                    <span className="text-base">🏠</span>
                    <div className="flex flex-1 items-center justify-between gap-1">
                      {Array.from({ length: STEPS_PER_SECTION }).map((_, step) => {
                        const isBoatHere = isCurrentSection && step === boatStep
                        const isFilled = isPastSection || (isCurrentSection && step <= boatStep)
                        return (
                          <HeartStep
                            key={step}
                            filled={isFilled && !isBoatHere}
                            isBoat={isBoatHere}
                          />
                        )
                      })}
                    </div>
                    {/* 도착 섬 */}
                    <span className="text-base">🏝️</span>
                  </div>
                )}

                {/* 잠금 상태 */}
                {!isUnlocked && (
                  <div className="flex items-center justify-center py-2">
                    <p className="text-xs text-gray-400">
                      레벨 {section.minLevel}에 도달하면 항해할 수 있어요
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 하단 안내 */}
        <div className="mt-4 shrink-0 rounded-xl bg-pink-50 px-4 py-3 text-center">
          <p className="text-xs text-gray-500">
            오늘 미션 90% 이상 완료하면 배가 한 칸 앞으로 가요! ❤️
          </p>
        </div>
      </div>
    </ChildBottomSheetShell>
  )
}
