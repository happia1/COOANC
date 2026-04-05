/**
 * 부모 앱용 컴팩트 자녀 프로필 카드 (홈·자녀 상세 공통)
 * - 왼쪽: 아바타 + 이름 + 크레딧·하트·연속일 + (나이) — 오른쪽 캐릭터·레벨 블록과 비슷한 높이로 맞춤
 * - 오른쪽: 마스코트 + Lv·단계
 * - 홈에서만: 하단 전체 너비로 오늘 미션 달성률
 */

const LEVEL_NAMES = ['씨앗', '새싹', '교환사', '저축왕', '나눔이', '투자가']
const LEVEL_EMOJI = ['🌱', '🌿', '🤝', '🐷', '💝', '🚀']
const LEVEL_MASCOT = ['🐰', '🐣', '🦊', '🐷', '🧸', '🚀']

/** 홈 탭에서만 넘기면 카드 안에 오늘 미션 달성률 바가 붙습니다 */
export type ProfileMissionSummary = {
  ratePercent: number
  completed: number
  total: number
}

export type CompactChildProfileCardProps = {
  name: string
  age: number | null
  avatarUrl: string | null
  level: number
  credits: number
  hearts: number
  streakDays: number
  className?: string
  mission?: ProfileMissionSummary | null
}

export function CompactChildProfileCard({
  name,
  age,
  avatarUrl,
  level,
  credits,
  hearts,
  streakDays,
  className = '',
  mission = null,
}: CompactChildProfileCardProps) {
  const lv = Math.min(Math.max(level, 0), LEVEL_NAMES.length - 1)
  const stageName = LEVEL_NAMES[lv]

  return (
    <div className={`bg-white rounded-xl px-2.5 py-2 shadow-sm ring-1 ring-black/[0.04] ${className}`.trim()}>
      {/* 상단: 좌·우 블록이 같은 시각 높이를 갖도록 min-h + 세로 가운데 정렬 */}
      <div className="flex min-h-[4.75rem] items-center gap-2.5">
        <div className="flex min-h-[4.75rem] min-w-0 flex-1 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sky-100 to-sky-200 shadow-inner ring-2 ring-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[28px] leading-none" aria-hidden>
                {LEVEL_EMOJI[lv]}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <p className="truncate text-base font-black leading-tight text-gray-900">{name}</p>

            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-black tabular-nums leading-tight"
              aria-label="크레딧, 하트, 연속 미션 일수"
            >
              <span className="text-[#4A90E2]" title="크레딧">
                🪙{credits.toLocaleString()}
              </span>
              <span className="text-rose-500" title="하트">
                ❤️{hearts}
              </span>
              <span className="text-amber-600" title="연속 미션 일수">
                🔥{streakDays}일
              </span>
            </div>

            {age != null && (
              <p className="text-xs text-gray-400 tabular-nums leading-tight">{age}세</p>
            )}
          </div>
        </div>

        <div className="flex min-h-[4.75rem] w-[58px] shrink-0 flex-col items-center justify-center gap-1">
          <span className="text-[28px] leading-none drop-shadow-sm" aria-hidden>
            {LEVEL_MASCOT[lv]}
          </span>
          <div className="flex w-full flex-col items-center gap-0.5 text-center">
            <span
              className="rounded-full bg-[#4A90E2]/12 px-2 py-0.5 text-[10px] font-black leading-none text-[#4A90E2] tabular-nums"
              title={`레벨 ${lv} ${stageName}`}
            >
              Lv.{lv}
            </span>
            <span className="text-[11px] font-bold leading-tight text-gray-600">{stageName}</span>
          </div>
        </div>
      </div>

      {mission != null && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-gray-700">⭐ 오늘 미션 달성률</p>
            <span className="shrink-0 text-sm font-black text-[#4A90E2] tabular-nums">
              {mission.ratePercent}%
              <span className="text-[10px] font-normal text-gray-400 ml-1">
                ({mission.completed}/{mission.total})
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F8E71C] to-[#7ED321] transition-all"
              style={{ width: `${mission.ratePercent}%` }}
            />
          </div>
          {mission.ratePercent === 100 && mission.total > 0 && (
            <p className="mt-1 text-right text-[10px] font-bold text-[#7ED321]">🎉 오늘 미션 모두 완료!</p>
          )}
        </div>
      )}
    </div>
  )
}
