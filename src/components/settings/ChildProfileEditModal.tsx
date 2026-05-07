'use client'

/**
 * 설정 화면 — 자녀 프로필 수정 모달
 * - 온보딩과 동일하게 이름·생년월일·연령대(미취학/학령)·보육·통학 형태를 바꿀 수 있어요.
 * - 가정보육 ↔ 어린이집·유치원·학교 전환 시 루틴 탭의 하원 알림 등에 반영됩니다(API 저장 후 목록 새로고침).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { birthDateInputBounds, getAgeFromBirthDateIso, resolveDisplayAge } from '@/lib/ageFromBirthDate'
import { ChildProfileAvatarPicker } from '@/components/common/ChildProfileAvatarPicker'
import { isAllowedChildProfileAvatarUrl } from '@/lib/childProfileAvatar'

export type LinkedChildForEdit = {
  id: string
  name: string
  birth_date: string | null
  age: number | null
  institution_type: string | null
  /** DB 에 있으면 생일 추정보다 우선해 연령대 칩을 맞춥니다 */
  age_group: string | null
  /** 저장된 값이 허용 목록에 없으면(예: 옛 데이터) UI 에서는 아무 캐릭터도 선택되지 않은 것처럼 보입니다(null) */
  avatar_url: string | null
}

type AgeGroup = 'preschool' | 'school'
type InstitutionType = 'home' | 'daycare' | 'kindergarten' | 'school'

/** 저장 API 가 돌려주는 프로필 일부 — 설정 목록을 즉시 맞출 때 사용 */
export type ChildProfileSaveResult = {
  ok?: boolean
  profile?: { avatar_url?: string | null }
}

type Props = {
  open: boolean
  child: LinkedChildForEdit | null
  onClose: () => void
  /**
   * 저장 성공 후 목록 갱신용.
   * - `sentAvatarUrl`: 요청에 실어 보낸 값(응답에 `profile` 이 없어도 카드에 바로 반영).
   */
  onSaved: (result: ChildProfileSaveResult | undefined, childId: string, sentAvatarUrl: string | null) => void
}

function institutionGrid(ag: AgeGroup): { value: InstitutionType; label: string }[] {
  if (ag === 'preschool') {
    return [
      { value: 'home', label: '가정보육' },
      { value: 'daycare', label: '어린이집' },
      { value: 'kindergarten', label: '유치원' },
    ]
  }
  return [
    { value: 'school', label: '학교' },
    { value: 'home', label: '홈스쿨' },
  ]
}

function normalizeInstitutionForGroup(ag: AgeGroup, raw: string | null | undefined): InstitutionType {
  const v = (raw ?? 'home') as InstitutionType
  const allowed = new Set(institutionGrid(ag).map((x) => x.value))
  if (allowed.has(v)) return v
  return ag === 'preschool' ? 'home' : 'school'
}

export default function ChildProfileEditModal({ open, child, onClose, onSaved }: Props) {
  const dateBounds = useMemo(() => birthDateInputBounds(), [])
  const [mounted, setMounted] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftBirth, setDraftBirth] = useState('')
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('preschool')
  const [institution, setInstitution] = useState<InstitutionType>('home')
  /** 허용된 URL 만 두고, DB 값이 이상하면 null (선택 없음·저장 시 사진 없음과 동일 취급) */
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !child) return
    setDraftName(child.name)
    setDraftBirth(child.birth_date ?? '')
    const fromDb =
      child.age_group === 'preschool' || child.age_group === 'school' ? child.age_group : null
    const a = resolveDisplayAge(child.birth_date, child.age)
    const ag: AgeGroup = fromDb ?? (a !== null && a >= 7 ? 'school' : 'preschool')
    setAgeGroup(ag)
    setInstitution(normalizeInstitutionForGroup(ag, child.institution_type))
    const av = child.avatar_url?.trim() ?? ''
    setDraftAvatarUrl(av && isAllowedChildProfileAvatarUrl(av) ? av : null)
    setError(null)
  }, [open, child])

  const pickAgeGroup = useCallback(
    (ag: AgeGroup) => {
      setAgeGroup(ag)
      setInstitution((prev) => normalizeInstitutionForGroup(ag, prev))
    },
    [],
  )

  async function handleSave() {
    if (!child) return
    if (!draftBirth.trim()) {
      setError('생년월일을 선택해 주세요.')
      return
    }
    if (getAgeFromBirthDateIso(draftBirth) === null) {
      setError('생년월일을 확인해 주세요. 만 1~18세만 등록할 수 있어요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      /**
       * `JSON.stringify` 는 값이 `undefined` 인 키를 통째로 빼므로,
       * `avatarUrl` 이 빠지면 서버는 `avatar_url` 을 전혀 갱신하지 않습니다. 항상 `null`/`string` 만 넘깁니다.
       */
      const payload = {
        childId: child.id,
        name: draftName.trim(),
        birthDate: draftBirth.trim(),
        institutionType: institution,
        /** 카드·루틴에 표시할 연령대를 DB 와 맞춥니다 */
        ageGroup,
        /** null 이면 프로필 사진 칸을 비웁니다 */
        avatarUrl: draftAvatarUrl ?? null,
      }
      const res = await fetch('/api/child/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        /** 응답이 끝없이 기다려지면 모달이 영원히 닫히지 않으므로 상한을 둡니다. */
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(45_000) : undefined,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof j.error === 'string' ? j.error : '저장에 실패했어요.')
        return
      }
      /**
       * 부모 `onSaved` 안에서 예외가 나면(예: 예전 `router.refresh()` 가 막혀 있을 때) 여기까지 와도 `onClose` 가
       * 호출되지 않아 슬라이드 시트가 내려가지 않는 것처럼 보일 수 있어, 콜백만 감쌉니다.
       */
      try {
        onSaved(j as ChildProfileSaveResult, child.id, payload.avatarUrl)
      } catch (e) {
        console.error('[ChildProfileEditModal] onSaved', e)
      }
      onClose()
    } catch {
      setError('네트워크 오류가 났어요.')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || !open || !child) return null

  const modal = (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-edit-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(92dvh,100vh)] w-full max-w-none flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-md sm:rounded-3xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden" aria-hidden />
        <div className="shrink-0 border-b border-gray-100 px-5 pb-3 pt-4">
          <h2 id="child-edit-title" className="text-center text-sm font-black text-gray-900">
            자녀 프로필 수정
          </h2>
          <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
            이름·생일·보육 형태를 바꾸면 루틴·알림 설정에도 반영돼요.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            <ChildProfileAvatarPicker value={draftAvatarUrl} onChange={setDraftAvatarUrl} />

            <div>
              <label className="mb-1 block text-[11px] font-bold text-gray-500" htmlFor="edit-child-name">
                자녀 이름 (닉네임)
              </label>
              <input
                id="edit-child-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#4A90E2]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-gray-500" htmlFor="edit-child-birth">
                생년월일
              </label>
              <input
                id="edit-child-birth"
                type="date"
                min={dateBounds.min}
                max={dateBounds.max}
                value={draftBirth}
                onChange={(e) => setDraftBirth(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-800 [color-scheme:light] outline-none focus:ring-2 focus:ring-[#4A90E2]/30"
              />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold text-gray-500">연령대</p>
              <div className="flex gap-1.5">
                {(
                  [
                    ['preschool', '미취학', '7세 미만'],
                    ['school', '학령기', '초등 이상'],
                  ] as const
                ).map(([v, l, s]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => pickAgeGroup(v)}
                    className={`flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all ${
                      ageGroup === v ? 'border-[#4A90E2] bg-[#4A90E2]/10 text-[#4A90E2]' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {l}
                    <span className="block text-[10px] font-normal leading-tight">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold text-gray-500">보육·통학 형태</p>
              <div className={`grid gap-1.5 ${ageGroup === 'preschool' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {institutionGrid(ageGroup).map(({ value: v, label: l }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setInstitution(v)}
                    className={`rounded-lg border-2 py-2 text-xs font-bold transition-all ${
                      institution === v ? 'border-[#4A90E2] bg-[#4A90E2]/10 text-[#4A90E2]' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="text-center text-xs font-bold text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-xl bg-[#4A90E2] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
