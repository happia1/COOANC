'use client'

import { formatRemainingMmSs } from '@/lib/youtubeContent'

type Props = {
  remainingSec: number
  paused?: boolean
  /** center: 상단 가운데 · right: 상단 오른쪽(시청 화면) */
  align?: 'center' | 'right'
}

/** 시청 화면 상단 — 크게 보이는 남은 시간 */
export default function ContentWatchTimer({ remainingSec, paused = false, align = 'center' }: Props) {
  const positionClass =
    align === 'right'
      ? 'pointer-events-none flex justify-end px-3 pt-[max(0.5rem,env(safe-area-inset-top))]'
      : 'pointer-events-none absolute inset-x-0 top-0 z-[3] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]'

  return (
    <div className={positionClass}>
      <div
        className={`rounded-2xl px-4 py-2 shadow-lg ring-2 ${
          paused ? 'bg-amber-500/90 ring-amber-200/80' : 'bg-black/80 ring-white/25'
        }`}
      >
        <p className="text-center text-[9px] font-bold uppercase tracking-wide text-white/80">
          {paused ? '일시정지' : '남은 시간'}
        </p>
        <p className="text-center text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">
          {formatRemainingMmSs(remainingSec)}
        </p>
      </div>
    </div>
  )
}
