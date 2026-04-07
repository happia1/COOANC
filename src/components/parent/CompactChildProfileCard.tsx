/**
 * 부모 앱용 컴팩트 자녀 프로필 카드 (홈·자녀 상세 공통)
 * - 왼쪽: 아바타 + 이름 + 크레딧·하트·연속일 + (나이) — 오른쪽 레벨 블록과 비슷한 높이로 맞춤
 * - 오른쪽: Lv·단계 이름(이모지 없이 텍스트만)
 * - 홈에서만: 하단 전체 너비로 오늘 미션 달성률
 *
 * 통계 줄(크레딧·하트·연속)의 그림은 `public/assets/img/common/ui/icons.png` 한 장을 잘라 쓰는
 * 스프라이트입니다. 자녀 홈 알약·미션 카드와 같은 자산을 써서 화면 전체 톤을 맞춥니다.
 */

import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

const LEVEL_NAMES = ['씨앗', '새싹', '교환사', '저축왕', '나눔이', '투자가']

/** 프로필 한 줄에 맞게 아이콘만 살짝 작게(숫자 옆 데코용) */
const STAT_ICON_PX = 18

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
  /** 미취학 / 학령기 — 프로필·나이 기준으로 부모 홈·루틴에서 넘깁니다 */
  ageGroupLabel?: string | null
  /** 가정보육·어린이집 등 — DB 에 없으면 생략 */
  childcareLabel?: string | null
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
  ageGroupLabel = null,
  childcareLabel = null,
}: CompactChildProfileCardProps) {
  const lv = Math.min(Math.max(level, 0), LEVEL_NAMES.length - 1)
  const stageName = LEVEL_NAMES[lv]
  /** 연령대와 보육 문구를 한 줄로 이어 붙입니다(둘 다 없으면 행 자체를 숨깁니다) */
  const metaParts = [ageGroupLabel?.trim(), childcareLabel?.trim()].filter(Boolean) as string[]
  const metaLine = metaParts.length > 0 ? metaParts.join(' · ') : null

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
              <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-black leading-tight text-sky-800">
                {stageName}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            {/* 이름과 나이를 한 줄에 배치 (홈·루틴 카드 공통) */}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <p className="truncate text-base font-black leading-tight text-gray-900">{name}</p>
              {age != null && (
                <span className="shrink-0 text-xs font-bold tabular-nums text-gray-400">{age}세</span>
              )}
            </div>

            {metaLine && (
              <p className="text-[11px] font-bold leading-tight text-gray-500 truncate" title={metaLine}>
                {metaLine}
              </p>
            )}

            {/**
             * 크레딧·하트·연속: 글자 대신 icons.png 안의 `credits`·`heart`·`timer` 조각을 보여 줍니다.
             * (연속은 불 아이콘이 시트에 없어, ‘매일 이어짐’에 가깝게 타이머 프레임을 사용합니다.)
             * 읽기 도구용 설명은 아래 `aria-label`에 그대로 한글로 남깁니다.
             */}
            <div
              className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-bold tabular-nums leading-tight sm:gap-x-3 sm:text-sm"
              aria-label={`크레딧 ${credits.toLocaleString()}, 하트 ${hearts}, 연속 미션 ${streakDays}일`}
            >
              <span className="inline-flex items-center gap-1 text-[#4A90E2]" title="크레딧">
                <span className="inline-flex shrink-0" aria-hidden>
                  <SpriteImage
                    sheet={ICONS}
                    frame="credits"
                    width={STAT_ICON_PX}
                    clipRotated={false}
                    className="select-none"
                  />
                </span>
                {credits.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 text-rose-500" title="하트(경험치)">
                <span className="inline-flex shrink-0" aria-hidden>
                  <SpriteImage sheet={ICONS} frame="heart" width={STAT_ICON_PX} className="select-none" />
                </span>
                {hearts}
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600" title="연속 미션 일수">
                <span className="inline-flex shrink-0" aria-hidden>
                  <SpriteImage sheet={ICONS} frame="timer" width={STAT_ICON_PX} className="select-none" />
                </span>
                {streakDays}일
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-[4.75rem] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 text-center">
          <span
            className="rounded-full bg-[#4A90E2]/12 px-2 py-0.5 text-[10px] font-black leading-none text-[#4A90E2] tabular-nums"
            title={`레벨 ${lv} ${stageName}`}
          >
            Lv.{lv}
          </span>
          <span className="text-[11px] font-bold leading-tight text-gray-600">{stageName}</span>
        </div>
      </div>

      {mission != null && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-gray-700">오늘 미션 달성률</p>
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
            <p className="mt-1 text-right text-[10px] font-bold text-[#7ED321]">오늘 미션 모두 완료!</p>
          )}
        </div>
      )}
    </div>
  )
}
