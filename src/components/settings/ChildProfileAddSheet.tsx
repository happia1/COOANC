'use client'

/**
 * 설정 화면 — 자녀 프로필 추가용 하단 슬라이드 시트
 *
 * - 온보딩과 같은 순서: ① 이름·생일·캐릭터 선택 → API 로 자녀 생성 ② `RoutineOnboarding` 으로 초기 루틴·알람 설정
 * - 배경 탭하면 닫힘. 자녀가 이미 생성된 뒤(② 단계 포함) 닫으면 목록 새로고침을 위해 `onRegistered` 를 부모에게 알립니다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { birthDateInputBounds, getAgeFromBirthDateIso } from '@/lib/ageFromBirthDate'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import { ChildProfileAvatarPicker } from '@/components/common/ChildProfileAvatarPicker'
import { CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW } from '@/lib/childProfileAvatar'

/** 루틴 온보딩은 무겁므로 시트가 열릴 때만 클라이언트에서 불러 옵니다 */
const RoutineOnboarding = dynamic(() => import('@/components/onboarding/RoutineOnboarding'), {
  ssr: false,
  loading: () => (
    <p className="py-8 text-center text-xs font-bold text-gray-400">초기 루틴 설정을 불러오는 중…</p>
  ),
})

export type ChildProfileAddSheetProps = {
  open: boolean
  onClose: () => void
  /** 자녀 계정이 한 번이라도 생성된 뒤 시트가 닫히거나, 루틴 설정을 끝냈을 때 호출 — 목록 API 를 다시 부르세요 */
  onRegistered?: () => void
}

type Phase = 'form' | 'routine'

export default function ChildProfileAddSheet({ open, onClose, onRegistered }: ChildProfileAddSheetProps) {
  const dateBounds = useMemo(() => birthDateInputBounds(), [])
  const [mounted, setMounted] = useState(false)
  /** 패널이 아래에서 올라오는 느낌 — RoutineAlarmSettingsSheet 와 같은 이중 rAF 패턴 */
  const [sheetEntered, setSheetEntered] = useState(false)

  const [phase, setPhase] = useState<Phase>('form')
  const [childName, setChildName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [childAvatarUrl, setChildAvatarUrl] = useState<string | null>(
    () => CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW[0]?.url ?? null,
  )
  const [createdChildId, setCreatedChildId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  /** 시트가 열릴 때마다 폼과 애니메이션 상태를 초기화합니다 */
  useEffect(() => {
    if (!open) {
      setSheetEntered(false)
      return
    }
    setPhase('form')
    setCreatedChildId(null)
    setChildName('')
    setBirthDate('')
    setChildAvatarUrl(CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW[0]?.url ?? null)
    setError(null)
    setLoading(false)
    setSheetEntered(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const notifyRegisteredAndClose = useCallback(() => {
    if (createdChildId) onRegistered?.()
    onClose()
  }, [createdChildId, onRegistered, onClose])

  const handleBackdropClose = useCallback(() => {
    if (createdChildId) onRegistered?.()
    onClose()
  }, [createdChildId, onRegistered, onClose])

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
    }>(res)
    const payload = json ?? {}
    if (parseError) {
      setError('서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    if (!res.ok) {
      setError(typeof payload.error === 'string' ? payload.error : '자녀 등록에 실패했어요. 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    const cid = typeof payload.childId === 'string' ? payload.childId : null
    setCreatedChildId(cid)
    setPhase('routine')
    setLoading(false)
  }

  if (!mounted || !open) return null

  const titleId = 'child-add-sheet-title'

  const overlay = (
    <div
      className="fixed inset-0 z-[72] flex items-end justify-center sm:items-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${sheetEntered ? 'opacity-100' : 'opacity-0'}`}
        aria-label="닫기"
        onClick={handleBackdropClose}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-0 pb-0">
        <div
          className={`pointer-events-auto flex max-h-[min(94dvh,100vh)] w-full max-w-none flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
            sheetEntered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />

          <div className="shrink-0 border-b border-gray-100 px-5 pb-3 pt-2">
            <h2 id={titleId} className="text-center text-sm font-black text-gray-900">
              {phase === 'form' ? '자녀 프로필 추가' : '초기 루틴 설정'}
            </h2>
            <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
              {phase === 'form'
                ? '온보딩과 같이 이름·생일·캐릭터를 입력한 뒤, 초기 미션과 알람을 맞출 수 있어요.'
                : '알림과 루틴 미션을 한 번에 맞추면 바로 활용하기 좋아요. 나중에 루틴 탭에서도 바꿀 수 있어요.'}
            </p>
          </div>

          {phase === 'form' ? (
            <>
              <form id="child-add-form" onSubmit={(e) => void handleCreate(e)} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500" htmlFor="add-child-name">
                      자녀 이름 (닉네임)
                    </label>
                    <input
                      id="add-child-name"
                      type="text"
                      required
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="예: 민준이, 서연이"
                      className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#4A90E2]/35"
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500" htmlFor="add-child-birth">
                      생년월일
                    </label>
                    <input
                      id="add-child-birth"
                      type="date"
                      required
                      min={dateBounds.min}
                      max={dateBounds.max}
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-800 [color-scheme:light] outline-none focus:ring-2 focus:ring-[#4A90E2]/35"
                    />
                    <p className="text-[10px] leading-snug text-gray-400">만 나이는 생일 기준으로 맞춰져요. (만 1~18세)</p>
                  </div>

                  <ChildProfileAvatarPicker
                    mode="onboarding"
                    value={childAvatarUrl}
                    onChange={setChildAvatarUrl}
                    id="settings-add-child-avatar"
                  />

                  {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{error}</p> : null}
                </div>
              </form>

              <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={handleBackdropClose}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="child-add-form"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-[#4A90E2] py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading ? '등록 중…' : '다음 (자녀 등록)'}
                </button>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
              <RoutineOnboarding
                linkedChildId={createdChildId}
                onComplete={() => {
                  onRegistered?.()
                  onClose()
                }}
              />
              <button
                type="button"
                onClick={notifyRegisteredAndClose}
                className="mt-3 w-full py-2 text-center text-xs font-bold text-gray-400 underline"
              >
                건너뛰고 나중에 설정할게요
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
