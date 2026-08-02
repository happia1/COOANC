'use client'

/**
 * 부모 승인 탭 — 자녀 콘텐츠존(보물상자 「영상 보기」) 채널 제어
 * - 운영자가 기획한 기본 채널은 자녀별로 숨기기/보이기만 가능합니다.
 * - 「채널 추가하기」로 우리 가족 전용 채널을 새로 넣을 수 있고, 직접 추가한 채널만 삭제할 수 있습니다.
 */

import { useMemo, useState } from 'react'
import type { ContentCategory, ContentChannel } from '@/types/database'

type Props = {
  childId: string | null
  categories: ContentCategory[]
  /** 이 부모가 볼 수 있는 채널(기본 전체 + 우리 가족 전용) */
  channels: ContentChannel[]
  /** 선택 자녀가 숨긴 채널 id */
  hiddenChannelIds: Set<string>
  /** 선택 자녀에 해당하는 family_links.id */
  familyLinkIdForChild: string | null
  onHiddenChange: (next: Set<string>) => void
  onChannelCreated: (channel: ContentChannel) => void
  onChannelDeleted: (channelId: string) => void
}

function VisibilityToggle({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? '자녀에게 보임 — 눌러서 숨기기' : '숨김 — 눌러서 보이게 하기'}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? 'bg-[#7ED321]' : 'bg-gray-300'
      } ${disabled ? 'opacity-40' : 'active:scale-95'}`}
    >
      <span
        className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? 'right-[2px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

const EMPTY_ADD_FORM = { title: '', playlistUrl: '', description: '', categoryKey: '' }

export default function ParentContentChannelControl({
  childId,
  categories,
  channels,
  hiddenChannelIds,
  familyLinkIdForChild,
  onHiddenChange,
  onChannelCreated,
  onChannelDeleted,
}: Props) {
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [adding, setAdding] = useState(false)

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, ContentChannel[]>()
    for (const ch of channels) {
      const list = map.get(ch.category_key)
      if (list) list.push(ch)
      else map.set(ch.category_key, [ch])
    }
    return map
  }, [channels])

  async function toggleHidden(channelId: string, hide: boolean) {
    if (!childId) return
    setBusyChannelId(channelId)
    setError(null)
    try {
      const res = await fetch('/api/content/child-hidden-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, channelId, hidden: hide }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '저장하지 못했어요')
        return
      }
      const next = new Set(hiddenChannelIds)
      if (hide) next.add(channelId)
      else next.delete(channelId)
      onHiddenChange(next)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setBusyChannelId(null)
    }
  }

  async function deleteChannel(channelId: string) {
    if (!childId) return
    if (!window.confirm('이 채널을 삭제할까요?')) return
    setBusyChannelId(channelId)
    setError(null)
    try {
      const res = await fetch('/api/content/parent-channel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, channelId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '삭제하지 못했어요')
        return
      }
      onChannelDeleted(channelId)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setBusyChannelId(null)
    }
  }

  async function addChannel() {
    if (!childId) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/content/parent-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          title: addForm.title,
          playlistUrl: addForm.playlistUrl,
          description: addForm.description || undefined,
          categoryKey: addForm.categoryKey,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '채널을 추가하지 못했어요')
        return
      }
      onChannelCreated(json.channel)
      setAddForm(EMPTY_ADD_FORM)
      setAddOpen(false)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setAdding(false)
    }
  }

  if (!childId) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">콘텐츠존 채널 관리</h3>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white"
        >
          {addOpen ? '닫기' : '+ 채널 추가하기'}
        </button>
      </div>
      <p className="mt-1 text-[11px] font-bold text-gray-400">
        기본 채널은 숨기기/보이기만, 직접 추가한 채널은 삭제도 할 수 있어요.
      </p>

      {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}

      {addOpen ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
          <input
            value={addForm.title}
            onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="채널 이름"
            className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
          />
          <input
            value={addForm.playlistUrl}
            onChange={(e) => setAddForm((f) => ({ ...f, playlistUrl: e.target.value }))}
            placeholder="유튜브 링크(채널·플레이리스트·영상)"
            className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
          />
          <textarea
            value={addForm.description}
            onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="소개 문구(선택)"
            rows={2}
            className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
          />
          <select
            value={addForm.categoryKey}
            onChange={(e) => setAddForm((f) => ({ ...f, categoryKey: e.target.value }))}
            className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
          >
            <option value="">카테고리 선택</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={adding || !addForm.title || !addForm.playlistUrl || !addForm.categoryKey}
            onClick={() => void addChannel()}
            className="rounded-lg bg-brand-blue py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {adding ? '추가하는 중…' : '추가하기'}
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-4">
        {categories.map((cat) => {
          const list = channelsByCategory.get(cat.key) ?? []
          if (list.length === 0) return null
          return (
            <div key={cat.id}>
              <p className="mb-1.5 text-xs font-black text-gray-500">{cat.label}</p>
              <ul className="flex flex-col gap-1.5">
                {list.map((ch) => {
                  const isOwnFamilyChannel = ch.family_link_id !== null && ch.family_link_id === familyLinkIdForChild
                  const hidden = hiddenChannelIds.has(ch.id)
                  return (
                    <li
                      key={ch.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-800">
                          {ch.title}
                          {isOwnFamilyChannel ? (
                            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              우리 가족
                            </span>
                          ) : null}
                        </p>
                        {ch.description ? (
                          <p className="truncate text-[11px] font-bold text-gray-400">{ch.description}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <VisibilityToggle
                          on={!hidden}
                          disabled={busyChannelId === ch.id}
                          onToggle={() => void toggleHidden(ch.id, !hidden)}
                        />
                        {isOwnFamilyChannel ? (
                          <button
                            type="button"
                            disabled={busyChannelId === ch.id}
                            onClick={() => void deleteChannel(ch.id)}
                            className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
