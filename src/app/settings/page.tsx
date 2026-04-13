'use client'

/**
 * 앱 설정 화면
 * - 부모 프로필: 이름만 편집(이미지 없음), 흰 카드 래퍼 없이 페이지 배경 위에 표시
 * - 부모: 자녀 프로필은 홈 탭과 같은 카드 레이아웃(아바타·이름·Lv·메타) + 오른쪽 수정/삭제만(크레딧 숫자 없음)
 * - 계정 삭제(로그아웃 아래 회색 링크)
 * - 로그아웃
 * - 알림 / 소리 토글 (localStorage)
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

/** 설정에서 불러온 자녀 한 줄(수정 모달에 그대로 넘김) */
type LinkedChildRow = {
  id: string
  name: string
  birth_date: string | null
  age: number | null
  institution_type: string | null
  age_group: string | null
  /** 캐릭터 프로필 PNG 공개 경로 — 없으면 홈 카드에 레벨 이름이 대신 나옵니다 */
  avatar_url: string | null
  /** `child_stats.current_level` — 카드에 Lv 표시(없으면 0) */
  current_level: number
}

export default function SettingsPage() {
  const router = useRouter()
  const clearSelectionIfChildRemoved = useParentStore((s) => s.clearSelectionIfChildRemoved)

  const [notifOn, setNotifOn] = useState(true)
  const [soundOn, setSoundOn] = useState(true)

  const [profileName, setProfileName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)

  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  /** 프로필·역할 조회 전에는 null 로 두고, 잘못된 「자녀」표시(깜빡임)를 막음 */
  const [profileLoaded, setProfileLoaded] = useState(false)

  /** 부모만: family_links 로 묶인 자녀 목록 */
  const [linkedChildren, setLinkedChildren] = useState<LinkedChildRow[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  /** 삭제 확인 중인 자녀 id (같은 행에서 「정말 삭제」 단계) */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  /** 연필 → 자녀 프로필 수정 모달에 넘길 행 */
  const [editingChild, setEditingChild] = useState<LinkedChildRow | null>(null)

  /** 로컬 토글 + 내 프로필(role) 로드 — 끝나기 전엔 프로필 카드를 스켈레톤으로 둠 */
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

  /**
   * 자녀 목록을 Supabase 에서 다시 읽습니다.
   * - `trustedAvatarFromSave`: 프로필 저장 직후 재조회가 아직 옛 `avatar_url` 을 줄 때(읽기 지연 등),
   *   방금 API 가 확인한 값으로 **한 번 더 덮어** 카드 원형 사진이 바로 바뀌게 합니다.
   */
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
    /** 홈 카드와 동일하게 Lv 를 맞추기 위해 레벨만 추가 조회합니다 */
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

  /** 부모이고 프로필 확정 후에만 자녀 목록 로드 (역할 null 구간에 자녀 블록이 잠깐 뜨는 현상 방지) */
  useEffect(() => {
    void loadLinkedChildren()
  }, [loadLinkedChildren])

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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-100 via-white to-green-50">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-10 pt-6">
        {/* 상단: 화살표 대신 얇은 회색 글자로 뒤로가기(터치 영역은 글자 전체) */}
        <div className="mb-1 flex items-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-left text-[11px] font-light leading-snug text-gray-400 underline-offset-2 transition-colors hover:text-gray-500 hover:underline active:opacity-80"
          >
            이전으로 돌아가기
          </button>
        </div>

        {/** 부모·자녀 계정 이름만 — 프로필 사진은 두지 않고, 자녀 프로필처럼 흰 박스 없음 */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {userRole === 'parent' ? '부모 프로필' : '프로필'}
          </p>
          {!profileLoaded ? (
            <div className="space-y-2 animate-pulse" aria-hidden>
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-200" />
            </div>
          ) : (
            <div className="min-w-0">
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full max-w-[200px] rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
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
                    <p className="font-bold text-gray-800">{userName || '(이름 없음)'}</p>
                    <p className="text-[11px] text-gray-400">
                      {userRole === 'parent' ? '부모' : '자녀'} 계정
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="shrink-0 rounded-xl bg-[#4A90E2]/10 px-3 py-1.5 text-xs font-bold text-[#4A90E2]"
                  >
                    편집
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {profileLoaded && userRole === 'parent' ? (
          <div className="flex flex-col gap-3">
            {/** 위「부모 프로필」·아래「알림」과 같이 페이지 배경만 둡니다. */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">자녀 프로필</p>
            {childrenLoading ? (
              <p className="text-sm font-bold text-gray-700">불러오는 중…</p>
            ) : linkedChildren.length === 0 ? (
              <p className="text-sm font-bold text-gray-800">연결된 자녀가 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {linkedChildren.map((c) => {
                  /** 홈 탭과 같은 나이·연령대·보육 라벨 규칙 */
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
          </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">알림 &amp; 소리</p>
          <ToggleRow label="푸시 알림" emoji="🔔" on={notifOn} onToggle={toggleNotif} />
          <ToggleRow label="효과음" emoji="🔊" on={soundOn} onToggle={toggleSound} />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-2xl border-2 border-red-200 bg-white py-4 text-sm font-bold text-red-500 shadow-sm transition-all active:scale-95"
        >
          🚪 로그아웃
        </button>

        {profileLoaded && userRole === 'parent' ? <DeleteParentAccountSection /> : null}
      </div>

      <ChildProfileEditModal
        open={editingChild !== null}
        child={editingChild}
        onClose={() => setEditingChild(null)}
        onSaved={(result, childId, sentAvatarUrl) => {
          /**
           * API 응답의 `profile.avatar_url` 을 `loadLinkedChildren` 안에서 병합합니다.
           * (먼저 `setLinkedChildren` 만 하고 곧바로 `loadLinkedChildren()` 을 호출하면,
           * 비동기 재조회가 끝날 때 옛 DB 값으로 덮어써서 원형 사진이 안 바뀐 것처럼 보입니다.)
           */
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
          /**
           * 이 페이지는 전부 클라이언트 컴포넌트라 `router.refresh()` 는 필수가 아닙니다.
           * 저장 직후 동기적으로 호출하면 일부 환경에서 오래 막혀 모달의 `onClose` 가 실행되지 않을 수 있어 제거했습니다.
           */
        }}
      />
    </div>
  )
}

/** 수정(연필) 아이콘 — 버튼 안에만 씁니다 */
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

/** 삭제(휴지통) 아이콘 */
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
