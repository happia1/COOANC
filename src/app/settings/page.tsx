'use client'

/**
 * 앱 설정 화면
 * - 프로필 이름 편집
 * - 로그아웃
 * - 알림 / 소리 토글 (localStorage)
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useParentStore } from '@/store/parentStore'
import { removeLocalStorageScopedToChild } from '@/lib/localStorageChildScope'

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

  /** 부모만: family_links 로 묶인 자녀 목록 (이름·id) */
  const [linkedChildren, setLinkedChildren] = useState<{ id: string; name: string }[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  /** 삭제 확인 중인 자녀 id (같은 행에서 「정말 삭제」 단계) */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

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

  /** 부모이고 프로필 확정 후에만 자녀 목록 로드 (역할 null 구간에 자녀 블록이 잠깐 뜨는 현상 방지) */
  useEffect(() => {
    if (!profileLoaded || userRole !== 'parent') {
      setLinkedChildren([])
      setChildrenLoading(false)
      return
    }
    let cancelled = false
    setChildrenLoading(true)
    setDeleteMsg(null)
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setChildrenLoading(false)
        return
      }
      const { data: links, error: linkErr } = await supabase
        .from('family_links')
        .select('child_id')
        .eq('parent_id', user.id)
      if (linkErr || cancelled) {
        if (!cancelled) setChildrenLoading(false)
        return
      }
      const ids = (links ?? []).map((l) => l.child_id).filter(Boolean)
      if (ids.length === 0) {
        if (!cancelled) {
          setLinkedChildren([])
          setChildrenLoading(false)
        }
        return
      }
      const { data: rows, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('id', ids)
        .eq('role', 'child')
      if (profErr || cancelled) {
        if (!cancelled) setChildrenLoading(false)
        return
      }
      if (!cancelled) {
        setLinkedChildren(
          (rows ?? []).map((r) => ({
            id: r.id,
            name: (r.name ?? '').trim() || '이름 없음',
          })),
        )
        setChildrenLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profileLoaded, userRole])

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

  /** 목록에 보이는 자녀를 순서대로 삭제 (테스트용 다건 정리) */
  async function deleteAllLinkedChildren() {
    const list = [...linkedChildren]
    if (list.length === 0) return
    setDeleteMsg(null)
    setPendingDeleteId(null)
    for (const c of list) {
      const ok = await deleteChildProfile(c.id)
      if (!ok) break
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
        <div className="mb-2 flex items-center">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl font-bold leading-none text-gray-500 transition-colors hover:bg-gray-100"
          >
            {'<'}
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">프로필</p>
          {!profileLoaded ? (
            <div className="flex items-center gap-3 animate-pulse" aria-hidden>
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-gray-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-36 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-200" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4A90E2]/20 to-[#7ED321]/20 text-2xl">
                {userRole === 'parent' ? '👩‍💼' : '🧒'}
              </div>
              <div className="min-w-0 flex-1">
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
            </div>
          )}
        </div>

        {profileLoaded && userRole === 'parent' ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">자녀 프로필</p>
            {childrenLoading ? (
              <p className="text-sm font-bold text-gray-700">불러오는 중…</p>
            ) : linkedChildren.length === 0 ? (
              <p className="text-sm font-bold text-gray-800">연결된 자녀가 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {linkedChildren.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-800">{c.name}</p>
                      </div>
                      {pendingDeleteId === c.id ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] font-bold text-red-600">정말 삭제할까요?</span>
                          <div className="flex gap-1">
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
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteMsg(null)
                            setPendingDeleteId(c.id)
                          }}
                          className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 active:scale-95"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {linkedChildren.length > 0 ? (
              <button
                type="button"
                disabled={!!deletingId}
                onClick={() => {
                  const n = linkedChildren.length
                  if (
                    !window.confirm(
                      `연결된 자녀 ${n}명을 모두 삭제할까요? 로그인 계정과 데이터가 영구 삭제되며 복구할 수 없습니다.`,
                    )
                  ) {
                    return
                  }
                  void deleteAllLinkedChildren()
                }}
                className="w-full rounded-xl border-2 border-red-300 bg-white py-2.5 text-xs font-bold text-red-600 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
              >
                연결된 자녀 모두 삭제 ({linkedChildren.length}명)
              </button>
            ) : null}
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
      </div>
    </div>
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
