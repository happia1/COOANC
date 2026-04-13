/**
 * 부모 앱용 컴팩트 자녀 프로필 카드 (홈·설정·자녀 상세 공통)
 * - 왼쪽: 아바타
 * - 가운데(세로): **이름 + Lv**(Lv 는 얇은 글씨·회색) → **미취학·유치원·나이** — 아바타 원과 **세로 가운데** 맞춤
 * - 오른쪽: 기본은 크레딧·하트·연속일 **2열 그리드** — `hideStats` 이면 통계 대신 `actions`(설정의 수정/삭제 등)
 * - 홈에서만: 하단 전체 너비로 오늘 미션 달성률(`mission`)
 *
 * 통계: 크레딧·하트는 `icons.png` 스프라이트, 연속 일은 불꽃 SVG(스트릭).
 */

import type { ReactNode } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

const LEVEL_NAMES = ['씨앗', '새싹', '교환사', '저축왕', '나눔이', '투자가']

/** 통계 숫자가 `text-[11px]` 일 때 옆 아이콘 높이를 글자 크기에 맞춤 */
const STAT_ICON_PX_MOBILE = 11
/** `sm:text-sm`(14px) 구간에서 동일하게 맞춤 */
const STAT_ICON_PX_SM = 14

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

  /** 카드 바깥: 얇은 링·그림자(테두리처럼 보이던 것) 없이 흰 배경만 — 홈·루틴·설정 동일 */
  return (
    <div className={`rounded-xl bg-white px-2.5 py-2 ${className}`.trim()}>
      {/** 한 행 전체를 세로 가운데 정렬 — 자녀 정보 텍스트 블록이 프로필 사진(원)의 중앙과 맞도록 합니다 */}
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 min-h-0 flex-1 items-center gap-3">
          {/** 원형 뒤는 흰색만 — 예전 하늘색 그라데이션·흰 링은 제거했습니다. */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white">
            {avatarUrl ? (
              /**
               * 프로필 PNG 는 귀·턱이 길어 `object-cover` 만 쓰면 원 밖으로 잘려 보입니다.
               * 안쪽 여백(`p-2`) + `object-contain` 으로 그림 전체가 원 안에 들어가고, 상대적으로 작게 보입니다.
               */
              <div className="flex h-full w-full items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="" className="h-full w-full object-contain object-center" />
              </div>
            ) : (
              <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-black leading-tight text-gray-700">
                {stageName}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
            {/**
             * 첫 줄: 이름은 진한 제목, Lv 는 보조 정보처럼 얇은 글씨·회색(단계 별칭은 title 만).
             */}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <p className="min-w-0 truncate text-base font-black leading-tight text-gray-900">{name}</p>
              <span
                className="shrink-0 text-xs font-light tabular-nums leading-none text-gray-500"
                title={`레벨 ${lv} · ${stageName}`}
              >
                Lv.{lv}
              </span>
            </div>

            {/**
             * 둘째 줄: 미취학·유치원·나이 순으로 있으면 모두 `·`로 연결합니다.
             */}
            {secondaryLine && (
              <p
                className="text-[11px] font-bold leading-tight text-gray-500 truncate"
                title={secondaryLine}
              >
                {secondaryLine}
              </p>
            )}
          </div>
        </div>

        {hideStats ? (
          <div className="flex shrink-0 flex-col items-end justify-center gap-1">
            {/* 설정 탭: 크레딧 칸 대신 수정·삭제(또는 삭제 확인) */}
            {actions}
          </div>
        ) : (
        <div
          className="grid shrink-0 grid-cols-[14px_auto] items-center gap-x-1.5 gap-y-1 text-[11px] font-bold tabular-nums leading-none sm:grid-cols-[18px_auto] sm:text-sm"
          aria-label={`크레딧 ${credits.toLocaleString()}, 하트 ${hearts}, 연속 미션 ${streakDays}일`}
        >
          {/**
           * 아이콘 높이를 숫자 글자 크기(11px / sm:14px)에 맞춤 — `sm:hidden`·`hidden sm:flex` 로
           * 서버 컴포넌트에서도 미디어쿼리만으로 두 크기를 전환합니다.
           */}
          <span
            className="flex h-[11px] w-full shrink-0 items-center justify-center justify-self-center sm:h-3.5"
            aria-hidden
          >
            <span className="flex sm:hidden">
              <SpriteImage
                sheet={ICONS}
                frame="credits"
                width={STAT_ICON_PX_MOBILE}
                clipRotated={false}
                className="select-none"
              />
            </span>
            <span className="hidden sm:flex">
              <SpriteImage
                sheet={ICONS}
                frame="credits"
                width={STAT_ICON_PX_SM}
                clipRotated={false}
                className="select-none"
              />
            </span>
          </span>
          <span className="text-right text-[#4A90E2]" title="크레딧">
            {credits.toLocaleString()}
          </span>

          <span
            className="flex h-[11px] w-full shrink-0 items-center justify-center justify-self-center sm:h-3.5"
            aria-hidden
          >
            <span className="flex sm:hidden">
              <SpriteImage sheet={ICONS} frame="heart" width={STAT_ICON_PX_MOBILE} className="select-none" />
            </span>
            <span className="hidden sm:flex">
              <SpriteImage sheet={ICONS} frame="heart" width={STAT_ICON_PX_SM} className="select-none" />
            </span>
          </span>
          <span className="text-right text-rose-500" title="하트(경험치·EXP)">
            {hearts}
          </span>

          {/** 불꽃: 연속 일수 — 글자 크기에 맞춘 두 벌 SVG */}
          <span
            className="flex h-[11px] w-full shrink-0 items-center justify-center justify-self-center sm:h-3.5"
            aria-hidden
          >
            <span className="flex sm:hidden">
              <svg
                width={STAT_ICON_PX_MOBILE}
                height={STAT_ICON_PX_MOBILE}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 text-orange-500"
              >
                <path
                  d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="hidden sm:flex">
              <svg
                width={STAT_ICON_PX_SM}
                height={STAT_ICON_PX_SM}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 text-orange-500"
              >
                <path
                  d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          <span className="text-right text-amber-600" title="연속 미션 일수">
            {streakDays}일
          </span>
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
