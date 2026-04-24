/**
 * 부모 앱용 컴팩트 자녀 프로필 카드 (홈·설정·자녀 상세 공통)
 * - 왼쪽: 아바타(둥근 사각 — 동그라미 프레임 없음)
 * - 가운데(세로): **이름 + Lv**(Lv 는 얇은 글씨·회색) → **미취학·유치원·나이** — 아바타 썸네일과 **세로 가운데** 맞춤
 * - 오른쪽: 기본은 크레딧·하트·연속일 **2열 그리드** — `hideStats` 이면 통계 대신 `actions`(설정의 수정/삭제 등)
 * - 홈에서만: 하단 전체 너비로 오늘 미션 달성률(`mission`)
 *
 * 통계: 크레딧·하트는 `icons.png` 스프라이트, 연속 일은 불꽃 SVG(스트릭).
 */

import type { ReactNode } from 'react'

const LEVEL_NAMES = ['씨앗', '새싹', '교환사', '저축왕', '나눔이', '투자가']

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
  /** true 이면 오른쪽 통계(크레딧·하트·연속일)를 숨기고 `actions` 만 표시합니다 */
  hideStats?: boolean
  /** `hideStats` 일 때 오른쪽 열에 넣는 UI(버튼·삭제 확인 등) */
  actions?: ReactNode
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
  hideStats = false,
  actions = null,
}: CompactChildProfileCardProps) {
  const lv = Math.min(Math.max(level, 0), LEVEL_NAMES.length - 1)
  const stageName = LEVEL_NAMES[lv]
  /** 둘째 줄: 연령대·보육·나이를 `·`로 이은 문장(비어 있으면 해당 행 숨김) */
  const metaParts = [ageGroupLabel?.trim(), childcareLabel?.trim()].filter(Boolean) as string[]
  const secondaryParts = [...metaParts, ...(age != null ? [`${age}세`] : [])]
  const secondaryLine = secondaryParts.length > 0 ? secondaryParts.join('·') : null

  /**
   * 공통 카드 레이아웃(요청 반영):
   * 1) 이름
   * 2) 레벨 정보
   * 3) 메타 정보(연령대·기관·나이)
   * 4) 크레딧/하트/연속일수
   *
   * 화면 중앙 정렬로 통일해, 부모 앱의 자녀 프로필 카드가 어디서 보든 같은 인상을 주게 합니다.
   */
  return (
    <div className={`rounded-xl bg-white px-2.5 py-2 ${className}`.trim()}>
      <div className="flex flex-col items-center text-center">
        {/** 상단 프로필 썸네일: 배경을 흰색으로 유지해 캐릭터가 또렷하게 보이도록 합니다. */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
          {avatarUrl ? (
            /**
             * PNG 캐릭터가 더 크게 보이도록 내부 여백을 줄입니다.
             * (contain 유지로 잘림 없이 전체 형태는 그대로 보장)
             */
            <div className="flex h-full w-full items-center justify-center p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt="" className="h-full w-full object-contain object-center" />
            </div>
          ) : (
            <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-black leading-tight text-gray-700">
              {stageName}
            </span>
          )}
        </div>

        {/** 1) 이름 + 작은 레벨(요청사항: 이름 옆 작은 폰트) */}
        <div className="mt-2 flex max-w-full items-baseline justify-center gap-1.5">
          <p className="max-w-[70%] truncate text-base font-black leading-tight text-gray-900">{name}</p>
          <p className="shrink-0 text-[11px] font-bold text-gray-600" title={`레벨 ${lv} · ${stageName}`}>
            Lv.{lv}
          </p>
        </div>

        {/** 3) 메타 정보 */}
        {secondaryLine && (
          <p className="mt-0.5 max-w-full truncate text-[11px] font-bold leading-tight text-gray-500" title={secondaryLine}>
            {secondaryLine}
          </p>
        )}

        {hideStats ? (
          <div className="mt-2 flex w-full flex-col items-center justify-center gap-1">
            {/* 설정 화면의 수정/삭제 버튼도 가운데 정렬로 통일 */}
            {actions}
          </div>
        ) : (
          /**
           * 4) 크레딧 / 하트 / 연속일수:
           * - 이미지 예시처럼 숫자를 먼저 보여주고, 아래 라벨을 붙입니다.
           * - 세 항목은 가운데 정렬 + 세로 구분선으로 한 눈에 구분되게 배치합니다.
           */
          <div
            className="mt-2 grid w-full grid-cols-3 overflow-hidden rounded-lg border border-gray-100 bg-white"
            aria-label={`크레딧 ${credits.toLocaleString()}, 하트 ${hearts}, 연속 미션 ${streakDays}일`}
          >
            <StatCell value={credits.toLocaleString()} label="크레딧" valueClassName="text-gray-800" />
            <StatCell value={hearts.toLocaleString()} label="하트" valueClassName="text-gray-800" withDivider />
            <StatCell value={`${streakDays}일`} label="연속" valueClassName="text-gray-800" withDivider />
          </div>
        )}
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

/**
 * 통계 한 칸(숫자 + 라벨)
 * - 중앙 정렬 카드에서 재사용할 수 있도록 작은 단위 컴포넌트로 분리합니다.
 */
function StatCell({
  value,
  label,
  valueClassName,
  withDivider = false,
}: {
  value: string
  label: string
  valueClassName?: string
  withDivider?: boolean
}) {
  return (
    <div className={['flex flex-col items-center justify-center px-2 py-2 text-center', withDivider ? 'border-l border-gray-200' : ''].join(' ')}>
      <span className={['text-base font-black leading-none tabular-nums', valueClassName ?? 'text-gray-900'].join(' ')}>{value}</span>
      <span className="mt-1 text-[10px] font-bold leading-none text-gray-500">{label}</span>
    </div>
  )
}
