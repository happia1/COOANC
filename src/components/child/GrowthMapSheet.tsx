'use client'

import ChildBottomSheetShell from '@/components/child/ChildBottomSheetShell'
import GrowthMapSection from '@/components/child/GrowthMapSection'
import StickerTab from '@/components/child/StickerTab'
import type { BadgeRow, ChildStats } from '@/types/database'

/** 지도 시트 + 뱃지 컬렉션에 넘기는 묶음 데이터 */
export type GrowthMapSheetData = {
  badges: BadgeRow[]
  earnedMap: Record<string, string>
  level: number
  streak: number
  longestStreak: number
}

type Props = {
  open: boolean
  onClose: () => void
  childName: string
  /** child_stats 가 없으면 성장 지도 자리에 안내만 보여요 */
  stats: ChildStats | null
  data: GrowthMapSheetData
}

const TITLE_ID = 'growth-map-sheet-title'

/**
 * 지도 모양 플로팅 버튼으로 여는 시트 — 성장 지도 + (기존 스티커 탭에 있던) 전체 뱃지 목록
 */
export default function GrowthMapSheet({ open, onClose, childName, stats, data }: Props) {
  return (
    <ChildBottomSheetShell open={open} onClose={onClose} titleId={TITLE_ID}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-2">
        <h2 id={TITLE_ID} className="sr-only">
          성장 지도와 뱃지
        </h2>
        <div className="flex flex-col gap-4">
          {stats ? (
            <GrowthMapSection stats={stats} />
          ) : (
            <div className="rounded-2xl bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
              아직 레벨 정보가 없어요. 미션이 시작되면 성장 지도가 열려요.
            </div>
          )}
          <StickerTab
            badges={data.badges}
            earnedMap={data.earnedMap}
            level={data.level}
            streak={data.streak}
            longestStreak={data.longestStreak}
            childName={childName}
            headingMain="뱃지 컬렉션"
            headingSub={`${childName}의 뱃지 · 지도에서 모아 보기`}
          />
        </div>
      </div>
    </ChildBottomSheetShell>
  )
}
