'use client'

/**
 * 설정 화면 — 부모만: 연결된 자녀 목록과 「자녀 프로필 삭제」
 * - family_links 로 본인과 연결된 child_id 를 불러옵니다.
 * - 삭제 시 팝업으로 안내 후 「삭제」 입력으로 최종 확인합니다.
 * - 삭제 API: POST /api/child/delete { childId }
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentStore } from '@/store/parentStore'

type LinkedChild = { id: string; displayName: string }

/** 자녀 삭제 최종 확인 입력 문구 */
const CHILD_DELETE_PHRASE = '삭제'

type DeleteModalStep = 'closed' | 'intro' | 'confirm'

export default function ParentSettingsChildrenSection() {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  const [children, setChildren] = useState<LinkedChild[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [target, setTarget] = useState<LinkedChild | null>(null)
  const [step, setStep] = useState<DeleteModalStep>('closed')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadChildren = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setChildren([])
      setLoadingList(false)
      return
    }

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role !== 'parent') {
      setChildren([])
      setLoadingList(false)
      return
    }

    const { data: links, error: linkErr } = await supabase
      .from('family_links')
      .select('child_id, nickname')
      .eq('parent_id', user.id)

    if (linkErr) {
      setListError('자녀 목록을 불러오지 못했어요.')
      setChildren([])
      setLoadingList(false)
      return
    }

    const rows = links ?? []
    const childIds = rows.map((r) => r.child_id).filter(Boolean)
    if (childIds.length === 0) {
      setChildren([])
      setLoadingList(false)
      return
    }

    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', childIds)

    const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

    const list: LinkedChild[] = rows.map((r) => {
      const nick = r.nickname?.trim()
      const pname = (nameById[r.child_id] as string | undefined)?.trim()
      const displayName = pname || nick || '자녀'
      return { id: r.child_id, displayName }
    })

    setChildren(list)
    setLoadingList(false)
  }, [])

  useEffect(() => {
    void loadChildren()
  }, [loadChildren])

  function closeDeleteModal() {
    setStep('closed')
    setTarget(null)
    setConfirmText('')
    setDeleteError(null)
  }

  const canSubmitDelete = confirmText.trim() === CHILD_DELETE_PHRASE && !deleting

  async function submitChildDelete() {
    if (!target || !canSubmitDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/child/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: target.id }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        setDeleteError(typeof json.error === 'string' ? json.error : '삭제에 실패했어요.')
        return
      }
      if (selectedChildId === target.id) {
        setSelectedChildId(null)
      }
      closeDeleteModal()
      await loadChildren()
    } catch {
      setDeleteError('네트워크 오류가 발생했어요.')
    } finally {
      setDeleting(false)
    }
  }

  if (loadingList) {
    return (
      <div className="rounded-2xl bg-white p-4 text-center text-xs text-gray-400 shadow-sm">
        연결된 자녀 불러오는 중…
      </div>
    )
  }

  if (listError) {
    return (
      <div className="rounded-2xl bg-white p-4 text-center text-xs text-red-500 shadow-sm">
        {listError}
      </div>
    )
  }

  if (children.length === 0) {
    return null
  }

  return (
    <>
      <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">연결된 자녀</p>
        <p className="text-[11px] text-gray-400 -mt-1">
          자녀 계정·미션·크레딧까지 모두 지우려면 아래에서 해당 자녀의 프로필을 삭제하세요.
        </p>
        <ul className="flex flex-col gap-2">
          {children.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-sm font-bold text-gray-800">{c.displayName}</span>
              <button
                type="button"
                onClick={() => {
                  setTarget(c)
                  setStep('intro')
                  setConfirmText('')
                  setDeleteError(null)
                }}
                className="shrink-0 text-[11px] font-bold text-red-500 underline-offset-2 hover:underline"
              >
                프로필 삭제
              </button>
            </li>
          ))}
        </ul>
      </div>

      {step === 'intro' && target && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="child-del-intro-title"
        >
          <button type="button" aria-label="닫기" className="absolute inset-0 cursor-default" onClick={closeDeleteModal} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="child-del-intro-title" className="text-center text-sm font-black text-gray-800">
              자녀 프로필 삭제
            </h3>
            <p className="mt-3 text-center text-xs font-bold text-gray-800">「{target.displayName}」</p>
            <p className="mt-3 text-left text-xs leading-relaxed text-gray-600">
              이 자녀의 로그인 계정과 미션·크레딧·가족 연결 정보가 함께 영구 삭제됩니다. 복구할 수 없어요.
            </p>
            <p className="mt-4 text-center text-xs font-bold text-gray-700">삭제하시겠어요?</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('confirm')
                  setDeleteError(null)
                }}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-md active:scale-95"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && target && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="child-del-confirm-title"
        >
          <button type="button" aria-label="닫기" className="absolute inset-0 cursor-default" onClick={closeDeleteModal} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="child-del-confirm-title" className="text-center text-sm font-black text-gray-800">
              최종 확인
            </h3>
            <p className="mt-2 text-center text-xs text-gray-500">
              「{target.displayName}」 삭제를 계속하려면 아래에 「{CHILD_DELETE_PHRASE}」라고 입력하세요.
            </p>
            <label className="mt-4 block text-[11px] font-bold text-gray-700">
              확인 입력
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CHILD_DELETE_PHRASE}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-200"
              />
            </label>
            {deleteError && <p className="mt-2 text-center text-[11px] font-bold text-red-600">{deleteError}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setStep('intro')
                  setConfirmText('')
                  setDeleteError(null)
                }}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500 disabled:opacity-50"
              >
                이전
              </button>
              <button
                type="button"
                disabled={!canSubmitDelete}
                onClick={submitChildDelete}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-md active:scale-95 disabled:opacity-40"
              >
                {deleting ? '처리 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
