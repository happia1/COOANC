'use client'

import type { ChildStats } from '@/types/database'
import { CHILD_GROWTH_LEVELS } from '@/constants/childGrowthLevels'

type Props = {
  stats: ChildStats
}

/**
 * 홈에서 빼 온 「성장 지도」 한 블록 — 지도 아이콘 시트 안에만 넣습니다.
 */
export default function GrowthMapSection({ stats }: Props) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-bold text-brand-text">성장 지도</p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {CHILD_GROWTH_LEVELS.map((lv, idx) => {
          const isPast = lv.level < stats.current_level
          const isCurrent = lv.level === stats.current_level
          const isFuture = lv.level > stats.current_level
          return (
            <div key={lv.level} className="flex flex-shrink-0 items-center gap-1">
              <div
                className={[
                  'flex min-w-[52px] flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition-all',
                  isPast ? 'bg-brand-green/20' : '',
                  isCurrent ? 'scale-105 bg-brand-yellow/40 ring-2 ring-brand-yellow' : '',
                  isFuture ? 'opacity-35' : '',
                ].join(' ')}
              >
                <span className="text-[10px] font-black tabular-nums text-gray-500">Lv.{lv.level}</span>
                <span className={`text-[10px] font-bold leading-none ${isCurrent ? 'text-brand-text' : 'text-gray-400'}`}>
                  {lv.name}
                </span>
              </div>

              {idx < CHILD_GROWTH_LEVELS.length - 1 && (
                <span className={`text-xs font-bold ${isPast ? 'text-brand-green' : 'text-gray-200'}`}>→</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
