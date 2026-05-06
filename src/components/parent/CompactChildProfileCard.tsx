/**
 * 부모 앱용 컴팩트 자녀 프로필 카드 (홈·설정·자녀 상세 공통)
 * - **stack**(기본): 세로형 — (다자녀 시 ‹ › 는 프로필에서 먼 간격으로 배치·스와이프 동일 줄) 아바타(선택 시 ↗ 바로가기 뱃지) → 이름+L → …
 * - **row**(설정 탭 등): 한 줄형 — 좌 아바타 · 중앙 이름·Lv 및 그 아래 메타(미취학·유치원·나이) · 우측 끝 통계 또는 수정/삭제
 * - 홈에서만: 하단 전체 너비로 오늘 미션 달성률(`mission`)
 */

import type { ReactNode, TouchEvent } from 'react'

const LEVEL_NAMES = ['씨앗', '새싹', '교환사', '저축왕', '나눔이', '투자가']

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
   * 홈·루틴·승인에서 `ParentEnterChildUiLink` 로 카드를 감쌀 때만 true.
   * 아바타 오른쪽 아래에 작은 「바로가기」표시가 붙어, 탭 시 자녀 화면으로 들어간다는 뜻을 보여 줍니다.
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
  avatarEnterShortcut = false,
}: CompactChildProfileCardProps) {
  const lv = Math.min(Math.max(level, 0), LEVEL_NAMES.length - 1)
  const stageName = LEVEL_NAMES[lv]
  /** 둘째 줄: 연령대·보육·나이를 `·`로 이은 문장(비어 있으면 해당 행 숨김) */
  const metaParts = [ageGroupLabel?.trim(), childcareLabel?.trim()].filter(Boolean) as string[]
  const secondaryParts = [...metaParts, ...(age != null ? [`${age}세`] : [])]
  const secondaryLine = secondaryParts.length > 0 ? secondaryParts.join('·') : null
  const levelTitle = `레벨 ${lv} · ${stageName}`
  const statsAria = `크레딧 ${credits.toLocaleString()}, 하트 ${hearts}, 연속 미션 ${streakDays}일`

  const statsGridFull = (
    <div className="mt-2 grid w-full grid-cols-3 overflow-hidden rounded-lg border border-gray-100 bg-white" aria-label={statsAria}>
      <StatCell value={credits.toLocaleString()} label="크레딧" valueClassName="text-gray-800" />
      <StatCell value={hearts.toLocaleString()} label="하트" valueClassName="text-gray-800" withDivider />
      <StatCell value={`${streakDays}일`} label="연속" valueClassName="text-gray-800" withDivider />
    </div>
  )

  const statsGridDense = (
    <div className="grid min-w-[8.75rem] shrink-0 grid-cols-3 overflow-hidden rounded-lg border border-gray-100 bg-white" aria-label={statsAria}>
      <StatCell value={credits.toLocaleString()} label="크레딧" valueClassName="text-gray-800" dense />
      <StatCell value={hearts.toLocaleString()} label="하트" valueClassName="text-gray-800" withDivider dense />
      <StatCell value={`${streakDays}일`} label="연속" valueClassName="text-gray-800" withDivider dense />
    </div>
  )

  if (profileLayout === 'row') {
    return (
      <div className={`rounded-xl bg-white px-3 py-2.5 ${className}`.trim()}>
        <div className="flex items-center gap-3">
          <AvatarCircle avatarUrl={avatarUrl} stageName={stageName} boxClass="h-14 w-14" />

          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="min-w-0 truncate text-base font-black leading-tight text-gray-900">{name}</p>
              <p className="shrink-0 text-[11px] font-bold text-gray-600" title={levelTitle}>
                Lv.{lv}
              </p>
            </div>
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
              <div className="flex min-h-[3rem] items-center justify-end pr-3 md:pr-6">
                <SiblingNavArrow ariaLabel="이전 자녀로" orientation="prev" onPress={siblingNav.onPrev} />
              </div>
              <div className="flex justify-center px-2">
                <AvatarWithShortcut
                  avatarUrl={avatarUrl}
                  stageName={stageName}
                  /** 부모 화면 자녀 프로필 원형 아바타를 기존(4rem) 대비 1.6배(6.4rem)로 확대 */
                  boxClass="h-[6.4rem] w-[6.4rem]"
                  showShortcut={avatarEnterShortcut}
                />
              </div>
              <div className="flex min-h-[3rem] items-center justify-start pl-3 md:pl-6">
                <SiblingNavArrow ariaLabel="다음 자녀로" orientation="next" onPress={siblingNav.onNext} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <AvatarWithShortcut
              avatarUrl={avatarUrl}
              stageName={stageName}
              /** 부모 화면 자녀 프로필 원형 아바타를 기존(4rem) 대비 1.6배(6.4rem)로 확대 */
              boxClass="h-[6.4rem] w-[6.4rem]"
              showShortcut={avatarEnterShortcut}
            />
          </div>
        )}

        <div className="mt-2 flex max-w-full items-baseline justify-center gap-1.5">
          <p className="max-w-[70%] truncate text-base font-black leading-tight text-gray-900">{name}</p>
          <p className="shrink-0 text-[11px] font-bold text-gray-600" title={levelTitle}>
            Lv.{lv}
          </p>
        </div>

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

/** 캐릭터 원 + (선택) 오른쪽 아래 「바로가기」표시 — 뱃지는 장식만이라 터치는 부모 링크로 통과합니다 */
function AvatarWithShortcut({
  avatarUrl,
  stageName,
  boxClass,
  showShortcut,
}: {
  avatarUrl: string | null
  stageName: string
  boxClass: string
  showShortcut: boolean
}) {
  return (
    <div className="relative inline-flex shrink-0">
      <AvatarCircle avatarUrl={avatarUrl} stageName={stageName} boxClass={boxClass} />
      {showShortcut ? (
        <span
          className="pointer-events-none absolute bottom-[-1px] right-[-2px] z-[1] flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-gray-200/90"
          title="자녀 앱 화면으로 바로가기"
          aria-hidden
        >
          {/** 대각선 ↗ 로 「다른 화면으로 이동」을 직관적으로 표시 — 터치는 원형 안으로 통과시킵니다 */}
          <span className="block pb-px text-[13px] font-black leading-none text-slate-500">↗</span>
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
  const glyph = orientation === 'prev' ? '\u2039' : '\u203a'
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
      className="shrink-0 select-none border-0 bg-transparent px-1 py-0.5 text-[1.0625rem] font-extralight leading-none text-gray-400 transition-colors hover:text-gray-500 active:text-gray-600 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]/35"
    >
      {glyph}
    </button>
  )
}

function AvatarCircle({
  avatarUrl,
  stageName,
  boxClass,
}: {
  avatarUrl: string | null
  stageName: string
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
          {stageName}
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
