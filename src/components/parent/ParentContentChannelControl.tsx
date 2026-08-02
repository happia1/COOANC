'use client'

/**
 * 부모 승인 탭 — 자녀 콘텐츠존(보물상자 「영상 보기」) 채널 제어
 *
 * 화면 구성(비개발자 설명):
 * - 위쪽에 카테고리 키워드 탭이 있고, 탭을 누르면 그 종류의 채널만 보입니다.
 * - 채널은 자녀 화면과 똑같은 카드(썸네일 + 제목)로 보여, 아이가 볼 화면을 그대로 가늠할 수 있습니다.
 * - 카드를 누르면 팝업이 열려 소개 문구·링크를 확인하고, 자녀에게 보일지 끄고 켤 수 있습니다.
 * - 「채널 추가하기」로 우리 가족 전용 채널을 넣을 수 있고, 직접 넣은 채널만 삭제됩니다.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import ContentChannelThumbnail from '@/components/child/ContentChannelThumbnail'
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

const ALL_TAB = '__all__'

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
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [detailChannel, setDetailChannel] = useState<ContentChannel | null>(null)
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [adding, setAdding] = useState(false)

  /** 채널이 하나라도 있는 카테고리만 탭으로 보여 줍니다(빈 탭 방지) */
  const tabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ch of channels) {
      counts.set(ch.category_key, (counts.get(ch.category_key) ?? 0) + 1)
    }
    const list = categories
      .filter((c) => counts.has(c.key))
      .map((c) => ({ key: c.key, label: c.label, count: counts.get(c.key) ?? 0 }))
    return [{ key: ALL_TAB, label: '전체', count: channels.length }, ...list]
  }, [categories, channels])

  const visibleChannels = useMemo(() => {
    if (activeTab === ALL_TAB) return channels
    return channels.filter((ch) => ch.category_key === activeTab)
  }, [channels, activeTab])

  const categoryLabelOf = (key: string) => categories.find((c) => c.key === key)?.label ?? key

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
      setDetailChannel(null)
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

  const detailHidden = detailChannel ? hiddenChannelIds.has(detailChannel.id) : false
  const detailIsOwnFamily =
    detailChannel != null &&
    detailChannel.family_link_id !== null &&
    detailChannel.family_link_id === familyLinkIdForChild

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-gray-900">콘텐츠존 채널 관리</h3>
          <p className="mt-0.5 text-[11px] font-bold text-gray-400">
            아이가 보물상자에서 볼 영상이에요. 카드를 눌러 자세히 보고 켜고 끌 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="shrink-0 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white"
        >
          {addOpen ? '닫기' : '+ 채널 추가'}
        </button>
      </div>

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
            placeholder="소개 문구(선택) — 부모 화면에서만 보여요"
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

      {/* ── 카테고리 키워드 탭 (가로 스크롤) ── */}
      <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const on = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                on ? 'bg-brand-blue text-white shadow-sm' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label} {tab.count}
            </button>
          )
        })}
      </div>

      {/* ── 채널 카드 그리드 (자녀 화면과 같은 모양: 썸네일 + 제목) ── */}
      {visibleChannels.length === 0 ? (
        <p className="py-8 text-center text-sm font-bold text-gray-400">이 종류에는 아직 채널이 없어요</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {visibleChannels.map((ch) => {
            const hidden = hiddenChannelIds.has(ch.id)
            const isOwnFamily = ch.family_link_id !== null && ch.family_link_id === familyLinkIdForChild
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setDetailChannel(ch)}
                className={`relative overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition active:scale-[0.98] ${
                  hidden ? 'opacity-45' : ''
                }`}
              >
                <ContentChannelThumbnail playlistUrl={ch.playlist_url} storedThumbnailUrl={ch.thumbnail_url} />
                {hidden ? (
                  <span className="absolute left-1 top-1 rounded bg-gray-900/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    숨김
                  </span>
                ) : null}
                {isOwnFamily ? (
                  <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    우리 가족
                  </span>
                ) : null}
                <div className="px-1.5 py-1.5">
                  <p className="line-clamp-2 text-[10px] font-black leading-snug text-gray-900">{ch.title}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 상세 팝업 — 부모에게만 보이는 소개 문구·링크 + 노출 토글 ── */}
      {detailChannel && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-5"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setDetailChannel(null)
              }}
            >
              <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
                <ContentChannelThumbnail
                  playlistUrl={detailChannel.playlist_url}
                  storedThumbnailUrl={detailChannel.thumbnail_url}
                />
                <div className="px-4 py-3">
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    {categoryLabelOf(detailChannel.category_key)}
                  </span>
                  <h4 className="mt-1.5 text-base font-black leading-snug text-gray-900">
                    {detailChannel.title}
                  </h4>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] font-bold leading-relaxed text-gray-600">
                    {detailChannel.description ?? '등록된 소개 문구가 없어요.'}
                  </p>
                  <a
                    href={detailChannel.playlist_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block truncate text-[11px] font-bold text-brand-blue underline"
                  >
                    {detailChannel.playlist_url}
                  </a>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                    <span className="text-[13px] font-bold text-gray-700">
                      {detailHidden ? '자녀 화면에 숨김' : '자녀 화면에 보임'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!detailHidden}
                      aria-label={detailHidden ? '보이게 하기' : '숨기기'}
                      disabled={busyChannelId === detailChannel.id}
                      onClick={() => void toggleHidden(detailChannel.id, !detailHidden)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        detailHidden ? 'bg-gray-300' : 'bg-[#7ED321]'
                      } ${busyChannelId === detailChannel.id ? 'opacity-40' : 'active:scale-95'}`}
                    >
                      <span
                        className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          detailHidden ? 'left-[2px]' : 'right-[2px]'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {detailIsOwnFamily ? (
                      <button
                        type="button"
                        disabled={busyChannelId === detailChannel.id}
                        onClick={() => void deleteChannel(detailChannel.id)}
                        className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDetailChannel(null)}
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
