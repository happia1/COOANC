'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import { createClient } from '@/lib/supabase/client'
import { birthDateInputBounds, getAgeFromBirthDateIso } from '@/lib/ageFromBirthDate'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import RoutineOnboarding from '@/components/onboarding/RoutineOnboarding'
import { ChildProfileAvatarPicker } from '@/components/common/ChildProfileAvatarPicker'
import { CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW } from '@/lib/childProfileAvatar'

export default function OnboardingPage() {
  const dateBounds = useMemo(() => birthDateInputBounds(), [])

  const [childName, setChildName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  /** 온보딩에서는 첫 칸(여우)을 기본 선택 — 홈 섬 캐릭터·프로필 사진이 항상 일치합니다 */
  const [childAvatarUrl, setChildAvatarUrl] = useState<string | null>(
    () => CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW[0]?.url ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 자녀 생성 완료 후 설문 단계로 전환 (id 는 미션을 자녀에게 묶는 데 사용)
  const [createdChildName, setCreatedChildName] = useState<string | null>(null)
  const [createdChildId, setCreatedChildId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!birthDate.trim()) {
      setError('자녀 생년월일을 선택해 주세요.')
      return
    }
    if (getAgeFromBirthDateIso(birthDate) === null) {
      setError('생년월일을 확인해 주세요. 만 1~18세만 등록할 수 있어요.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      setError('로그인 세션이 만료됐어요. 다시 로그인해 주세요.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/child/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: childName,
        birthDate,
        parentId: user.id,
        ...(childAvatarUrl ? { avatarUrl: childAvatarUrl } : {}),
      }),
    })

    const { data: json, parseError } = await parseJsonFromResponse<{
      error?: string
      childId?: string
      name?: string
    }>(res)
    const payload = json ?? {}
    if (parseError) {
      setError('서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    if (!res.ok) {
      const errMsg =
        typeof payload.error === 'string' ? payload.error : '자녀 등록에 실패했어요. 다시 시도해 주세요.'
      setError(errMsg)
      setLoading(false)
      return
    }

    // 자녀 생성 완료 → 설문 화면으로 전환
    const cid = typeof payload.childId === 'string' ? payload.childId : null
    setCreatedChildId(cid)
    setCreatedChildName(childName.trim() || '자녀')
  }

  // ── 설문 화면 ────────────────────────────────────────────
  if (createdChildName !== null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-1.5 mb-3 shrink-0">
          <Image src={AUTH_LOGO_SRC} alt="COOANC" width={144} height={144} className="rounded-2xl max-h-24 w-auto" style={{ height: 'auto' }} />
          <h1 className="text-base font-black text-brand-blue text-center">초기 루틴 설정</h1>
        </div>
        <RoutineOnboarding linkedChildId={createdChildId} onComplete={() => { window.location.href = '/parent' }} />
        <button
          type="button"
          onClick={() => { window.location.href = '/parent' }}
          className="mt-4 text-xs text-gray-400 underline"
        >
          건너뛰고 나중에 설정할게요
        </button>
      </div>
    )
  }

  // ── 자녀 등록 폼 ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6 py-10">

      <div className="flex flex-col items-center gap-3 mb-7">
        <Image src={AUTH_LOGO_SRC} alt="COOANC" width={180} height={180} className="rounded-2xl" style={{ height: 'auto' }} />
        <div className="text-center">
          <h1 className="text-xl font-black text-brand-blue">첫 번째 자녀를 등록해요</h1>
          <p className="text-sm text-gray-400 mt-1">자녀 프로필을 만들면 미션을 시작할 수 있어요</p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-7 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="childName">
            자녀 이름 (닉네임)
          </label>
          <input
            id="childName"
            type="text"
            required
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="예: 민준이, 서연이"
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="birthDate">
            자녀 생년월일
          </label>
          <input
            id="birthDate"
            type="date"
            required
            min={dateBounds.min}
            max={dateBounds.max}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition"
          />
          <p className="text-[11px] text-gray-400 leading-snug">
            만 나이는 생일을 기준으로 자동으로 맞춰져요. (등록 가능: 만 1~18세)
          </p>
        </div>

        <ChildProfileAvatarPicker
          mode="onboarding"
          value={childAvatarUrl}
          onChange={setChildAvatarUrl}
          id="onboarding-avatar"
        />

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-green hover:bg-green-500 active:scale-95 text-white font-bold py-3 rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '등록 중...' : '자녀 등록하기'}
        </button>
      </form>
    </div>
  )
}
