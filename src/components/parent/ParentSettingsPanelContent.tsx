'use client'

/**
 * 설정 시트·직접 방문 페이지 공통 본문입니다.
 * - 부모 프로필 이름 편집, 자녀 목록, 다자녀일 때 「시작 화면 자녀」선택(localStorage),
 *   알림/소리 토글, 로그아웃, 계정 삭제 영역을 담습니다.
 * - 비개발자: 내용은 예전 `/settings` 페이지와 동일하고, 이제는 오버레이 시트 안에서만 보일 때가 많습니다.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import {
  profileAgeGroupShortLabel,
  profileInstitutionLabel,
  resolveProfileAgeGroup,
} from '@/lib/childProfileDisplay'
import { useParentStore } from '@/store/parentStore'
import { removeLocalStorageScopedToChild } from '@/lib/localStorageChildScope'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import DeleteParentAccountSection from '@/components/parent/DeleteParentAccountSection'
import ChildProfileEditModal from '@/components/settings/ChildProfileEditModal'
import ChildProfileAddSheet from '@/components/settings/ChildProfileAddSheet'
import {
  clearStoredDefaultChildIdIfMatches,
  getStoredDefaultChildId,
  setStoredDefaultChildId,
} from '@/lib/defaultChildIdPreference'

/** 설정에서 불러온 자녀 한 줄(수정 모달에 그대로 넘김) */
type LinkedChildRow = {
  id: string
  name: string
  birth_date: string | null
  age: number | null
  institution_type: string | null
  age_group: string | null
  avatar_url: string | null
  current_level: number
}

export default function ParentSettingsPanelContent() {
  const router = useRouter()
  const clearSelectionIfChildRemoved = useParentStore((s) => s.clearSelectionIfChildRemoved)

  const [notifOn, setNotifOn] = useState(true)
  const [soundOn, setSoundOn] = useState(true)

  const [profileName, setProfileName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactMessage, setContactMessage] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const [linkedChildren, setLinkedChildren] = useState<LinkedChildRow[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const [editingChild, setEditingChild] = useState<LinkedChildRow | null>(null)
  const [addChildSheetOpen, setAddChildSheetOpen] = useState(false)
  /** 자녀가 둘 이상일 때만 쓰는 「로그인 직후 열 아이」 선택값 — localStorage 와 동기 */
  const [startScreenPick, setStartScreenPick] = useState<string>('')

  /** 로컬 토글 + 내 프로필(role) 로드 */
  useEffect(() => {
    let cancelled = false
    setNotifOn(localStorage.getItem('cooanc_notif') !== 'off')
    setSoundOn(localStorage.getItem('cooanc_sound') !== 'off')

    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setProfileLoaded(true)
        return
      }
      const { data } = await supabase.from('profiles').select('name, role').eq('id', user.id).maybeSingle()
      if (!cancelled && data) {
        setUserName(data.name ?? '')
        setProfileName(data.name ?? '')
        setUserRole(data.role ?? null)
      }
      if (!cancelled) setProfileLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadLinkedChildren = useCallback(
    async (opts?: { trustedAvatarFromSave?: { childId: string; avatar_url: string | null } }) => {
      if (!profileLoaded || userRole !== 'parent') {
        setLinkedChildren([])
        setChildrenLoading(false)
        return
      }
      setChildrenLoading(true)
      setDeleteMsg(null)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setChildrenLoading(false)
        return
      }
      const { data: links, error: linkErr } = await supabase
        .from('family_links')
        .select('child_id')
        .eq('parent_id', user.id)
      if (linkErr) {
        setChildrenLoading(false)
        return
      }
      const ids = (links ?? []).map((l) => l.child_id).filter(Boolean)
      if (ids.length === 0) {
        setLinkedChildren([])
        setChildrenLoading(false)
        return
      }
      const { data: rows, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, role, birth_date, age, institution_type, age_group, avatar_url')
        .in('id', ids)
        .eq('role', 'child')
      if (profErr) {
        setChildrenLoading(false)
        return
      }
      const { data: statRows } = await supabase
        .from('child_stats')
        .select('child_id, current_level')
        .in('child_id', ids)
      const levelByChild = Object.fromEntries(
        (statRows ?? []).map((s) => {
          const row = s as { child_id: string; current_level?: number | null }
          const lv = typeof row.current_level === 'number' ? row.current_level : 0
          return [row.child_id, lv] as const
        }),
      )
      let nextRows = (rows ?? []).map((r) => ({
        id: r.id,
        name: (r.name ?? '').trim() || '이름 없음',
        birth_date: (r as { birth_date?: string | null }).birth_date ?? null,
        age: typeof (r as { age?: number | null }).age === 'number' ? (r as { age: number }).age : null,
        institution_type: (r as { institution_type?: string | null }).institution_type ?? null,
        age_group: (r as { age_group?: string | null }).age_group ?? null,
        avatar_url:
          typeof (r as { avatar_url?: string | null }).avatar_url === 'string'
            ? (r as { avatar_url: string }).avatar_url
            : null,
        current_level: levelByChild[r.id] ?? 0,
      }))
      const trust = opts?.trustedAvatarFromSave
      if (trust?.childId) {
        nextRows = nextRows.map((c) => (c.id === trust.childId ? { ...c, avatar_url: trust.avatar_url } : c))
      }
      setLinkedChildren(nextRows)
      setChildrenLoading(false)
    },
    [profileLoaded, userRole],
  )

  useEffect(() => {
    void loadLinkedChildren()
  }, [loadLinkedChildren])

  /**
   * 자녀 목록이 바뀔 때마다, 저장된 시작 화면 UUID 가 여전히 유효한지 확인합니다.
   * 없거나 삭제된 아이를 가리키면 빈 값(부모 홈 우선)으로 맞춥니다.
   */
  useEffect(() => {
    if (linkedChildren.length <= 1) return
    const stored = getStoredDefaultChildId()
    if (stored && linkedChildren.some((c) => c.id === stored)) {
      setStartScreenPick(stored)
      return
    }
    setStartScreenPick('')
    if (stored && !linkedChildren.some((c) => c.id === stored)) {
      setStoredDefaultChildId(null)
    }
  }, [linkedChildren])

  async function deleteChildProfile(childId: string) {
    setDeleteMsg(null)
    setDeletingId(childId)
    try {
      const res = await fetch('/api/child/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteMsg(typeof j.error === 'string' ? j.error : '삭제에 실패했어요.')
        return false
      }
      setLinkedChildren((prev) => prev.filter((c) => c.id !== childId))
      setPendingDeleteId(null)
      clearSelectionIfChildRemoved(childId)
      removeLocalStorageScopedToChild(childId)
      clearStoredDefaultChildIdIfMatches(childId)
      router.refresh()
      return true
    } catch {
      setDeleteMsg('네트워크 오류가 났어요.')
      return false
    } finally {
      setDeletingId(null)
    }
  }

  function toggleNotif() {
    const next = !notifOn
    setNotifOn(next)
    localStorage.setItem('cooanc_notif', next ? 'on' : 'off')
  }
  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('cooanc_sound', next ? 'on' : 'off')
  }

  async function handleNameSave() {
    if (!profileName.trim()) return
    setNameSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ name: profileName.trim() }).eq('id', user.id)
      setUserName(profileName.trim())
    }
    setNameSaving(false)
    setEditingName(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-1 pb-6 pt-1 md:mx-0 md:max-w-none">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {userRole === 'parent' ? '부모 프로필' : '프로필'}
          </p>
          {!profileLoaded ? (
            <div className="rounded-2xl bg-white p-5 shadow-sm" aria-hidden>
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-36 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-200" />
              </div>
            </div>
          ) : (
            <div className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleNameSave}
                      disabled={nameSaving}
                      className="rounded-xl bg-[#4A90E2] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {nameSaving ? '저장 중' : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName(false)
                        setProfileName(userName)
                      }}
                      className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-gray-800">{userName || '(이름 없음)'}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {userRole === 'parent' ? '부모' : '자녀'} 계정
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="rounded-xl bg-[#4A90E2]/10 px-3 py-1.5 text-xs font-bold text-[#4A90E2]"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {profileLoaded && userRole === 'parent' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">자녀 프로필</p>
              <button
                type="button"
                onClick={() => setAddChildSheetOpen(true)}
                className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-500 active:scale-95"
                aria-label="자녀 프로필 추가"
              >
                <span aria-hidden>+</span>
              </button>
            </div>
            {childrenLoading ? (
              <p className="text-sm font-bold text-gray-700">불러오는 중…</p>
            ) : linkedChildren.length === 0 ? (
              <p className="text-sm font-bold text-gray-800">연결된 자녀가 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {linkedChildren.map((c) => {
                  const displayAge = resolveDisplayAge(c.birth_date, c.age)
                  const ag = resolveProfileAgeGroup(c.age_group, displayAge)
                  return (
                    <li key={c.id} className="list-none">
                      <CompactChildProfileCard
                        name={c.name}
                        age={displayAge}
                        avatarUrl={c.avatar_url}
                        level={c.current_level}
                        credits={0}
                        hearts={0}
                        streakDays={0}
                        ageGroupLabel={profileAgeGroupShortLabel(ag)}
                        childcareLabel={profileInstitutionLabel(ag, c.institution_type)}
                        hideStats
                        profileLayout="row"
                        mission={null}
                        actions={
                          pendingDeleteId === c.id ? (
                            <div className="flex max-w-[9rem] flex-col items-end gap-1">
                              <span className="text-[10px] font-bold text-red-600">정말 삭제할까요?</span>
                              <div className="flex flex-wrap justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={deletingId === c.id}
                                  onClick={() => setPendingDeleteId(null)}
                                  className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === c.id}
                                  onClick={() => void deleteChildProfile(c.id)}
                                  className="rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                                >
                                  {deletingId === c.id ? '삭제 중…' : '삭제'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteMsg(null)
                                  setEditingChild(c)
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4A90E2]/10 text-[#4A90E2] transition-colors hover:bg-[#4A90E2]/18 active:scale-95"
                                aria-label={`${c.name} 프로필 수정`}
                              >
                                <PencilIcon className="h-[18px] w-[18px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteMsg(null)
                                  setPendingDeleteId(c.id)
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100 active:scale-95"
                                aria-label={`${c.name} 프로필 삭제`}
                              >
                                <TrashIcon className="h-[18px] w-[18px]" />
                              </button>
                            </div>
                          )
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
            {deleteMsg ? <p className="text-xs font-bold text-red-600">{deleteMsg}</p> : null}

            {linkedChildren.length > 1 ? (
              <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">시작 화면 자녀 선택</p>
                <p className="text-[11px] leading-snug text-gray-500">
                  로그인할 때 먼저 열릴 아이를 고릅니다. 「부모 홈에서 시작」이면 매번 부모 홈으로 들어가요.
                </p>
                <label className="sr-only" htmlFor="cooanc-start-screen-child">
                  시작 화면 자녀
                </label>
                <select
                  id="cooanc-start-screen-child"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                  value={startScreenPick}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartScreenPick(v)
                    setStoredDefaultChildId(v || null)
                  }}
                >
                  <option value="">부모 홈에서 시작</option>
                  {linkedChildren.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} 화면으로 시작
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">알림 &amp; 소리</p>
          <ToggleRow label="푸시 알림" emoji="🔔" on={notifOn} onToggle={toggleNotif} />
          <ToggleRow label="효과음" emoji="🔊" on={soundOn} onToggle={toggleSound} />
        </div>

        <footer className="rounded-2xl bg-white p-5 text-xs text-gray-500 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center gap-3">
            <img src="/favicon-96x96.png" alt="쿠앤크" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="font-black text-gray-800">COOANC 베타</p>
              <p className="mt-0.5 text-[10px]">아이와 부모를 위한 루틴 서비스</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <details className="rounded-xl bg-gray-50 px-3 py-2.5">
              <summary className="cursor-pointer font-bold text-gray-700">개인정보 안내</summary>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
                서비스 제공에 필요한 계정·자녀·루틴 정보를 처리합니다. 이용자는 자신의 개인정보와 자녀 정보에 대해 열람, 수정, 삭제 및 처리정지를 요청할 수 있습니다. 정식 개인정보 처리방침은 베타 운영 정보가 확정되는 대로 이 화면에 공개합니다.
              </p>
              <a href="https://law.go.kr/법령/개인정보보호법/제30조" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-bold text-brand-blue">개인정보 보호법 보기</a>
            </details>
            <details className="rounded-xl bg-gray-50 px-3 py-2.5">
              <summary className="cursor-pointer font-bold text-gray-700">저작권 안내</summary>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
                COOANC의 로고, 캐릭터, 일러스트, 화면 구성 및 콘텐츠는 저작권 또는 관련 권리의 보호를 받습니다. 권리자의 허락 없는 복제, 배포, 수정 및 상업적 이용을 금지합니다.
              </p>
              <a href="https://law.go.kr/법령/저작권법" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-bold text-brand-blue">저작권법 보기</a>
            </details>
          </div>

          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="mt-3 w-full rounded-xl border border-brand-blue/25 bg-brand-blue/[0.06] py-2.5 font-bold text-brand-blue active:scale-[0.99]"
          >
            개발자에게 문의하기
          </button>
          <p className="mt-4 border-t border-gray-100 pt-3 text-center text-[10px] text-gray-400">
            © 2026 COOANC. All rights reserved.
          </p>
        </footer>

        {profileLoaded && userRole === 'parent' ? <DeleteParentAccountSection /> : null}
      </div>

      <ChildProfileAddSheet
        open={addChildSheetOpen}
        onClose={() => setAddChildSheetOpen(false)}
        onRegistered={() => void loadLinkedChildren()}
      />

      <ChildProfileEditModal
        open={editingChild !== null}
        child={editingChild}
        onClose={() => setEditingChild(null)}
        onSaved={(result, childId, sentAvatarUrl) => {
          const fromApi = result?.profile?.avatar_url
          const av =
            typeof fromApi === 'string' || fromApi === null
              ? fromApi
              : typeof sentAvatarUrl === 'string' || sentAvatarUrl === null
                ? sentAvatarUrl
                : undefined
          if (childId && (typeof av === 'string' || av === null)) {
            void loadLinkedChildren({ trustedAvatarFromSave: { childId, avatar_url: av } })
          } else {
            void loadLinkedChildren()
          }
        }}
      />

      {contactOpen ? (
        <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="developer-contact-title">
          <button type="button" className="absolute inset-0" aria-label="문의창 닫기" onClick={() => setContactOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p id="developer-contact-title" className="text-base font-black text-gray-900">개발자 문의</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">내용을 작성하면 기기에 연결된 메일 앱이 열립니다.</p>
            <textarea
              autoFocus
              value={contactMessage}
              onChange={(event) => setContactMessage(event.target.value.slice(0, 1000))}
              rows={6}
              placeholder="문의 내용을 입력해 주세요"
              className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setContactOpen(false)} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-600">취소</button>
              <button
                type="button"
                disabled={!contactMessage.trim()}
                onClick={() => {
                  const email = process.env.NEXT_PUBLIC_DEVELOPER_CONTACT_EMAIL?.trim() || 'theotter@naver.com'
                  const subject = encodeURIComponent('[COOANC 베타] 개발자 문의')
                  const body = encodeURIComponent(contactMessage.trim())
                  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
                }}
                className="flex-1 rounded-xl bg-brand-blue py-2.5 text-sm font-bold text-white disabled:bg-gray-200"
              >
                메일 보내기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ToggleRow({ label, emoji, on, onToggle }: { label: string; emoji: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm font-bold text-gray-700">{label}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-12 rounded-full transition-all ${on ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
