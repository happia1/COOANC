'use client'

/**
 * 자녀 프로필용 캐릭터 얼굴(`*_profile.png`) 선택 UI
 * - `settings`: 그리드 + 「기본」 — 카드 사진 없음·레벨 이름 표시
 * - `onboarding`: 맨 아래 한 줄(여우→토끼→곰→햄스터→병아리) — 홈 섬 정면 캐릭터와 동일하게 맞춤
 */

import {
  CHILD_PROFILE_AVATAR_OPTIONS,
  CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW,
} from '@/lib/childProfileAvatar'

export type ChildProfileAvatarPickerProps = {
  value: string | null
  onChange: (url: string | null) => void
  id?: string
  /** `onboarding` 은 5종만 가로 나열, 「기본」 없음 */
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
          아래에서 골라요. 홈 섬에 정면으로 서 있는 친구가 바뀌어요.
        </p>
        <div className="flex flex-row items-end justify-between gap-1 sm:gap-1.5">
          {CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW.map(({ url, label }) => {
            const selected = value === url
            return (
              <button
                key={url}
                type="button"
                onClick={() => onChange(url)}
                title={label}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border-2 py-2 transition-all ${
                  selected
                    ? 'border-[#4A90E2] bg-[#4A90E2]/10 ring-2 ring-[#4A90E2]/15'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 public 정적 자산 */}
                <img
                  src={url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-inner sm:h-14 sm:w-14"
                />
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
        캐릭터를 고르면 부모 홈·루틴 카드 원형 사진으로 보여요. 안 고르면 레벨 이름이 표시돼요.
      </p>
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all ${
            value === null
              ? 'border-[#4A90E2] bg-[#4A90E2]/10 ring-2 ring-[#4A90E2]/20'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-sky-200 text-[9px] font-black leading-tight text-sky-800">
            기본
          </span>
          <span className="text-[9px] font-bold text-gray-500">자동</span>
        </button>
        {CHILD_PROFILE_AVATAR_OPTIONS.map(({ url, label }) => {
          const selected = value === url
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              title={label}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all ${
                selected
                  ? 'border-[#4A90E2] bg-[#4A90E2]/10 ring-2 ring-[#4A90E2]/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 public 정적 자산 */}
              <img
                src={url}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-inner"
              />
              <span className="max-w-full truncate text-[9px] font-bold text-gray-600">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
