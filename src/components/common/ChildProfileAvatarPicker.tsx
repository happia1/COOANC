'use client'

/**
 * 자녀 프로필용 캐릭터 얼굴(`*_profile.png`) 선택 UI
 * - `settings`: 캐릭터 4종 그리드(「기본」 없음 — DB 가 null 이면 카드에 레벨 이름 등 기존 규칙)
 * - `onboarding`: 맨 아래 한 줄 — 카드 안 사각 영역에 캐릭터(홈 섬과 같은 종류) 표시
 */

import { CHILD_PROFILE_AVATAR_OPTIONS, CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW } from '@/lib/childProfileAvatar'

export type ChildProfileAvatarPickerProps = {
  value: string | null
  onChange: (url: string | null) => void
  id?: string
  /** `onboarding` 은 캐릭터 목록만 가로 나열, 「기본」 없음 */
  mode?: 'settings' | 'onboarding'
}

export function ChildProfileAvatarPicker({
  value,
  onChange,
  id,
  mode = 'settings',
}: ChildProfileAvatarPickerProps) {
  if (mode === 'onboarding') {
    return (
      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4" id={id}>
        <p className="text-xs font-bold text-gray-500">홈 화면 캐릭터</p>
        <p className="text-[11px] leading-snug text-gray-400">
          자녀가 좋아하늩 케릭터를 설정해주세요.
        </p>
        {/* 온보딩: 각 카드(블록) 안에 사각 영역을 두고 캐릭터를 넣음 — 동그라미 링/프레임 없음 */}
        <div className="flex flex-row items-end justify-between gap-1 sm:gap-1.5">
          {CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW.map(({ url, label }) => {
            const selected = value === url
            return (
              <button
                key={url}
                type="button"
                onClick={() => onChange(url)}
                title={label}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border-2 px-0.5 py-1.5 transition-all sm:px-1 sm:py-2 ${
                  selected
                    ? 'border-[#4A90E2] bg-[#4A90E2]/10 ring-2 ring-[#4A90E2]/15'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* 카드 가로폭에 맞는 직사각 블록(둥근 모서리만) — 그림은 잘리지 않게 맞춤 */}
                <div className="flex h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-50 sm:h-12">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 public 정적 자산 */}
                  <img src={url} alt="" className="h-full w-full object-contain object-center p-0.5" />
                </div>
                <span className="max-w-full truncate px-0.5 text-[8px] font-bold text-gray-600 sm:text-[9px]">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" id={id}>
      <p className="text-xs font-bold text-gray-500">프로필 이미지</p>
      <p className="text-[11px] leading-snug text-gray-400">
        캐릭터를 고르면 부모 홈·루틴 카드에 사각 썸네일로 보여요. 아직 사진이 없으면 레벨 이름이 표시돼요.
      </p>
      {/**
       * 설정「자녀 프로필 수정」: 동그라미 프레임 없이 둥근 사각만. 선택은 옅은 회색 배경. 썸네일은 작게(h-8).
       */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
        {CHILD_PROFILE_AVATAR_OPTIONS.map(({ url, label }) => {
          const selected = value === url
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              title={label}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors ${
                selected ? 'bg-gray-100' : 'bg-transparent hover:bg-gray-50'
              }`}
            >
              {/** 흰 사각 배경만 — 원형 링·테두리 없음 */}
              <span className="block h-8 w-8 overflow-hidden rounded-lg bg-white sm:h-9 sm:w-9">
                {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 public 정적 자산 */}
                <img src={url} alt="" className="h-full w-full object-contain object-center p-0.5" />
              </span>
              <span className="max-w-full truncate text-[9px] font-bold text-gray-600">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
