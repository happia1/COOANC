/**
 * 부모 앱용 컴팩트 자녀 프로필 카드 (홈·설정·자녀 상세 공통)
 * - **stack**(기본): 세로형 — (다자녀 시 ‹ › 는 프로필에서 먼 간격으로 배치·스와이프 동일 줄) 아바타(선택 시 ↗ 바로가기 뱃지) → 이름+L → …
 * - **row**(설정 탭 등): 한 줄형 — 좌 아바타 · 중앙 이름·Lv 및 그 아래 메타(미취학·유치원·나이) · 우측 끝 통계 또는 수정/삭제
 * - 홈에서만: 하단 전체 너비로 오늘 미션 달성률(`mission`)
 */

import type { ReactNode, TouchEvent } from 'react'
import { getChildBadge } from '@/constants/childGrowthLevels'
import ParentEnterChildUiLink from '@/components/parent/ParentEnterChildUiLink'
import ParentChevron from '@/components/parent/ParentChevron'

/** 홈 탭에서만 넘기면 카드 안에 오늘 미션 달성률 바가 붙습니다 */
export type ProfileMissionSummary = {
  ratePercent: number
  completed: number
  total: number
}

/** 다자녀일 때 캐릭터 원형 양 옆 ‹ › — 박스·테두리 없음(프로필 카드 안에서만 씀) */
export type CompactChildProfileSiblingNav = {
  /** 이전 자녀로 전환(Zustand `selectedChildId`) */
  onPrev: () => void
  /** 다음 자녀 */
  onNext: () => void
  /** 아바타가 있는 가로 줄에 붙임 — 좌우 스와이프로도 같은 전환 (`useChildSiblingAvatarNav`) */
  onSwipeTouchStart?: (e: TouchEvent) => void
  onSwipeTouchEnd?: (e: TouchEvent) => void
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
  /**
   * `row` — 설정 탭처럼 한 줄형: 왼쪽 아바타 · 가운데 이름/Lv와 아래 메타 · 오른쪽 액션(또는 통계)
   * `stack`(기본) — 홈/루틴처럼 세로 중앙 정렬 카드
   */
  profileLayout?: 'stack' | 'row'
  /** 홈·루틴·승인: 자녀 2명 이상일 때만 넘김 → 아바타 양 옆 얇은 회색 화살표 */
  siblingNav?: CompactChildProfileSiblingNav | null
  /**
   * 아바타만 자녀 앱 진입 링크 — 다자녀 ‹ › 는 링크 밖에 두어 프로필 전환만 됩니다.
   */
  enterChildUi?: {
    childId: string
    ariaLabel: string
    onSelectChild?: () => void
  } | null
  /**
   * @deprecated `enterChildUi` 사용 — 있으면 아바타에 ↗ 바로가기 표시
   */
  avatarEnterShortcut?: boolean
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
  profileLayout = 'stack',
  siblingNav = null,
  enterChildUi = null,
  avatarEnterShortcut = false,
}: CompactChildProfileCardProps) {
  const showAvatarShortcut = Boolean(enterChildUi) || avatarEnterShortcut
  const lv = Math.max(0, level)
  const badge = getChildBadge(lv)
  const avatarFallbackLabel = badge?.badge ?? `Lv.${lv}`
  /** 둘째 줄: 연령대·보육·나이를 `·`로 이은 문장(비어 있으면 해당 행 숨김) */
  const metaParts = [ageGroupLabel?.trim(), childcareLabel?.trim()].filter(Boolean) as string[]
  const secondaryParts = [...metaParts, ...(age != null ? [`${age}세`] : [])]
  const secondaryLine = secondaryParts.length > 0 ? secondaryParts.join('·') : null
  const statsAria = `크레딧 ${credits.toLocaleString()}, 하트 ${hearts}, 레벨 ${lv}`

  const statsGridFull = (
    <div className="mt-2 grid w-full grid-cols-3 overflow-hidden rounded-lg border border-gray-100 bg-white" aria-label={statsAria}>
      <StatCell value={credits.toLocaleString()} label="크레딧" valueClassName="text-gray-800" />
      <StatCell value={hearts.toLocaleString()} label="하트" valueClassName="text-gray-800" withDivider />
      <StatCell value={`Lv.${lv}`} label="레벨" valueClassName="text-[#4A90E2]" withDivider />
    </div>
  )

  const statsGridDense = (
    <div className="grid min-w-[8.75rem] shrink-0 grid-cols-3 overflow-hidden rounded-lg border border-gray-100 bg-white" aria-label={statsAria}>
      <StatCell value={credits.toLocaleString()} label="크레딧" valueClassName="text-gray-800" dense />
      <StatCell value={hearts.toLocaleString()} label="하트" valueClassName="text-gray-800" withDivider dense />
      <StatCell value={`Lv.${lv}`} label="레벨" valueClassName="text-[#4A90E2]" withDivider dense />
    </div>
  )

  if (profileLayout === 'row') {
    return (
      <div className={`rounded-xl bg-white px-3 py-2.5 ${className}`.trim()}>
        <div className="flex items-center gap-3">
          <AvatarCircle avatarUrl={avatarUrl} fallbackLabel={avatarFallbackLabel} boxClass="h-14 w-14" />

          <div className="min-w-0 flex-1 text-left">
            <p className="min-w-0 truncate text-base font-black leading-tight text-gray-900">{name}</p>
            {secondaryLine ? (
              <p className="mt-0.5 truncate text-[11px] font-bold leading-tight text-gray-500" title={secondaryLine}>
                {secondaryLine}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 self-center">{hideStats ? actions : statsGridDense}</div>
        </div>

        {mission != null ? <MissionBlock mission={mission} /> : null}
      </div>
    )
  }

  return (
    <div className={`rounded-xl bg-white px-2.5 py-2 ${className}`.trim()}>
      <div className="flex flex-col items-center text-center">
        {siblingNav ? (
          <div
            className="flex w-full max-w-xl justify-center px-1"
            onTouchStart={siblingNav.onSwipeTouchStart}
            onTouchEnd={siblingNav.onSwipeTouchEnd}
          >
            {/**
             * 양쪽 열(`pr-4`/`pl-4`): ‹ › 와 원형 프로필 사이를 넓게 — 스와이프는 줄 전체에 동일하게 걸림
             */}
            <div className="grid w-full max-w-[20rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
              <div
                className="flex min-h-[3rem] cursor-pointer items-center justify-end pr-3 md:pr-6"
                /**
                 * 다자녀 UX 개선:
                 * 화살표 아이콘만이 아니라, 원형 캐릭터 바깥의 좌측 여백 전체를 눌러도 이전 자녀로 넘깁니다.
                 */
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  siblingNav.onPrev()
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                }}
                aria-hidden
              >
                <SiblingNavArrow ariaLabel="이전 자녀로" orientation="prev" onPress={siblingNav.onPrev} />
              </div>
              <div className="flex justify-center px-2">
                <ProfileAvatarWithHint
                  enterChildUi={enterChildUi}
                  avatarUrl={avatarUrl}
                  fallbackLabel={avatarFallbackLabel}
                  boxClass="h-[6.4rem] w-[6.4rem]"
                  showShortcut={showAvatarShortcut}
                />
              </div>
              <div
                className="flex min-h-[3rem] cursor-pointer items-center justify-start pl-3 md:pl-6"
                /**
                 * 다자녀 UX 개선:
                 * 화살표 아이콘만이 아니라, 원형 캐릭터 바깥의 우측 여백 전체를 눌러도 다음 자녀로 넘깁니다.
                 */
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  siblingNav.onNext()
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                }}
                aria-hidden
              >
                <SiblingNavArrow ariaLabel="다음 자녀로" orientation="next" onPress={siblingNav.onNext} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <ProfileAvatarWithHint
              enterChildUi={enterChildUi}
              avatarUrl={avatarUrl}
              fallbackLabel={avatarFallbackLabel}
              boxClass="h-[6.4rem] w-[6.4rem]"
              showShortcut={showAvatarShortcut}
            />
          </div>
        )}

        <p className="mt-2 max-w-full truncate text-base font-black leading-tight text-gray-900">{name}</p>

        {secondaryLine ? (
          <p className="mt-0.5 max-w-full truncate text-[11px] font-bold leading-tight text-gray-500" title={secondaryLine}>
            {secondaryLine}
          </p>
        ) : null}

        {hideStats ? (
          <div className="mt-2 flex w-full flex-col items-center justify-center gap-1">{actions}</div>
        ) : (
          statsGridFull
        )}
      </div>

      {mission != null ? <MissionBlock mission={mission} /> : null}
    </div>
  )
}

/** 프로필 사진 위 안내 + 아바타(자녀 앱 진입 링크) */
function ProfileAvatarWithHint({
  enterChildUi,
  avatarUrl,
  fallbackLabel,
  boxClass,
  showShortcut,
}: {
  enterChildUi: CompactChildProfileCardProps['enterChildUi']
  avatarUrl: string | null
  fallbackLabel: string
  boxClass: string
  showShortcut: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {enterChildUi ? (
        <p className="max-w-[12rem] px-1 text-center text-[10px] font-medium leading-snug text-gray-400">
          캐릭터를 클릭하면 자녀 앱으로 이동합니다
        </p>
      ) : null}
      <ProfileAvatarEnterLink
        enterChildUi={enterChildUi}
        avatarUrl={avatarUrl}
        fallbackLabel={fallbackLabel}
        boxClass={boxClass}
        showShortcut={showShortcut}
      />
    </div>
  )
}

/** 아바타만 자녀 앱 진입 — ‹ › 영역은 링크 밖 */
function ProfileAvatarEnterLink({
  enterChildUi,
  avatarUrl,
  fallbackLabel,
  boxClass,
  showShortcut,
}: {
  enterChildUi: CompactChildProfileCardProps['enterChildUi']
  avatarUrl: string | null
  fallbackLabel: string
  boxClass: string
  showShortcut: boolean
}) {
  const avatar = (
    <AvatarWithShortcut
      avatarUrl={avatarUrl}
      fallbackLabel={fallbackLabel}
      boxClass={boxClass}
      showShortcut={showShortcut}
    />
  )

  if (!enterChildUi) {
    return avatar
  }

  return (
    <ParentEnterChildUiLink
      childId={enterChildUi.childId}
      className="inline-flex rounded-full transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
      aria-label={enterChildUi.ariaLabel}
      onClick={enterChildUi.onSelectChild}
    >
      {avatar}
    </ParentEnterChildUiLink>
  )
}

/** 캐릭터 원 + (선택) 오른쪽 아래 「바로가기」표시 */
function AvatarWithShortcut({
  avatarUrl,
  fallbackLabel,
  boxClass,
  showShortcut,
}: {
  avatarUrl: string | null
  fallbackLabel: string
  boxClass: string
  showShortcut: boolean
}) {
  return (
    <div className="relative inline-flex shrink-0">
      <AvatarCircle avatarUrl={avatarUrl} fallbackLabel={fallbackLabel} boxClass={boxClass} />
      {showShortcut ? (
        <span
          className="pointer-events-none absolute bottom-[-1px] right-[14px] z-[1] flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-gray-200/90"
          title="자녀 앱 화면으로 바로가기"
          aria-hidden
        >
          {/** 대각선 ↗ 로 「다른 화면으로 이동」을 직관적으로 표시 — 터치는 원형 안으로 통과시킵니다 */}
          <span className="block translate-y-px text-[13px] font-black leading-none text-slate-500">↗</span>
        </span>
      ) : null}
    </div>
  )
}

/** 얇은 회색 ‹ / › 전용 버튼 — 배경·테두리 없음 */
function SiblingNavArrow({
  ariaLabel,
  orientation,
  onPress,
}: {
  ariaLabel: string
  orientation: 'prev' | 'next'
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      /** 링크(자녀 앱 들어가기)로 이벤트가 올라가지 않게 합니다 */
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onPress()
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
      }}
      onTouchEnd={(e) => {
        e.stopPropagation()
      }}
      className="flex shrink-0 select-none items-center justify-center border-0 bg-transparent px-1 py-0.5 text-gray-400 transition-colors hover:text-gray-500 active:text-gray-600 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]/35"
    >
      <ParentChevron direction={orientation === 'prev' ? 'left' : 'right'} size="lg" />
    </button>
  )
}

function AvatarCircle({
  avatarUrl,
  fallbackLabel,
  boxClass,
}: {
  avatarUrl: string | null
  fallbackLabel: string
  boxClass: string
}) {
  /**
   * 부모 앱 자녀 프로필 블록에서 햄스터 얼굴이 과하게 크게 보이는 문제를 줄이기 위해,
   * 햄스터 아바타일 때만 이미지 표시 크기를 살짝(약 88%) 축소합니다.
   */
  const isHamsterAvatar = /hamster/i.test(avatarUrl ?? '')
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white ${boxClass}`}>
      {avatarUrl ? (
        <div className="flex h-full w-full items-center justify-center p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt=""
            className={[
              'translate-y-1 object-contain object-center',
              isHamsterAvatar ? 'h-[88%] w-[88%]' : 'h-full w-full',
            ].join(' ')}
          />
        </div>
      ) : (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-black leading-tight text-gray-700">
          {fallbackLabel}
        </span>
      )}
    </div>
  )
}

function MissionBlock({ mission }: { mission: ProfileMissionSummary }) {
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-gray-700">오늘 미션 달성률</p>
        <span className="shrink-0 text-sm font-black text-[#4A90E2] tabular-nums">
          {mission.ratePercent}%
          <span className="ml-1 text-[10px] font-normal text-gray-400">
            ({mission.completed}/{mission.total})
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-gradient-to-r from-[#F8E71C] to-[#7ED321] transition-all" style={{ width: `${mission.ratePercent}%` }} />
      </div>
      {mission.ratePercent === 100 && mission.total > 0 && (
        <p className="mt-1 text-right text-[10px] font-bold text-[#7ED321]">오늘 미션 모두 완료!</p>
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
  dense = false,
}: {
  value: string
  label: string
  valueClassName?: string
  withDivider?: boolean
  dense?: boolean
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        dense ? 'px-1 py-1.5' : 'px-2 py-2',
        withDivider ? 'border-l border-gray-200' : '',
      ].join(' ')}
    >
      <span
        className={[
          dense ? 'text-sm font-black' : 'text-base font-black',
          'leading-none tabular-nums',
          valueClassName ?? 'text-gray-900',
        ].join(' ')}
      >
        {value}
      </span>
      <span className={['font-bold leading-none text-gray-500', dense ? 'mt-0.5 text-[9px]' : 'mt-1 text-[10px]'].join(' ')}>{label}</span>
    </div>
  )
}
