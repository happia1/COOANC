'use client'

/**
 * 콘텐츠존 기본 라인업(카테고리·채널) 운영자 관리 화면 — 클라이언트 파트.
 * 서버 컴포넌트에서 받은 초기 목록을 화면에 그대로 쓰고, 이후 추가/수정/삭제는
 * `/api/admin/content-categories`, `/api/admin/content-channels` 를 호출해 반영합니다.
 */

import { useMemo, useState } from 'react'
import type { ContentCategory, ContentChannel } from '@/types/database'

type Props = {
  initialCategories: ContentCategory[]
  initialChannels: ContentChannel[]
}

type ChannelFormState = {
  title: string
  playlistUrl: string
  description: string
  categoryKey: string
  thumbnailUrl: string
  orderIndex: string
}

const EMPTY_CHANNEL_FORM: ChannelFormState = {
  title: '',
  playlistUrl: '',
  description: '',
  categoryKey: '',
  thumbnailUrl: '',
  orderIndex: '0',
}

export default function AdminContentManagerClient({ initialCategories, initialChannels }: Props) {
  const [categories, setCategories] = useState<ContentCategory[]>(initialCategories)
  const [channels, setChannels] = useState<ContentChannel[]>(initialChannels)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [categoryForm, setCategoryForm] = useState({ key: '', label: '', orderIndex: '0' })
  const [channelForm, setChannelForm] = useState<ChannelFormState>(EMPTY_CHANNEL_FORM)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ChannelFormState>(EMPTY_CHANNEL_FORM)

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, ContentChannel[]>()
    for (const ch of channels) {
      const list = map.get(ch.category_key)
      if (list) list.push(ch)
      else map.set(ch.category_key, [ch])
    }
    return map
  }, [channels])

  async function callApi(path: string, method: string, body: unknown) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '요청에 실패했어요')
        return null
      }
      return json
    } catch {
      setError('네트워크 오류가 발생했어요')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function addCategory() {
    const json = await callApi('/api/admin/content-categories', 'POST', {
      key: categoryForm.key,
      label: categoryForm.label,
      orderIndex: Number(categoryForm.orderIndex) || 0,
    })
    if (!json?.category) return
    setCategories((prev) => [...prev, json.category].sort((a, b) => a.order_index - b.order_index))
    setCategoryForm({ key: '', label: '', orderIndex: '0' })
  }

  async function deleteCategory(id: string) {
    if (!window.confirm('이 카테고리를 삭제할까요?')) return
    const json = await callApi('/api/admin/content-categories', 'DELETE', { id })
    if (!json?.ok) return
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  function channelPayload(form: ChannelFormState) {
    return {
      title: form.title,
      playlistUrl: form.playlistUrl,
      description: form.description || null,
      categoryKey: form.categoryKey,
      thumbnailUrl: form.thumbnailUrl || null,
      orderIndex: Number(form.orderIndex) || 0,
    }
  }

  async function addChannel() {
    const json = await callApi('/api/admin/content-channels', 'POST', channelPayload(channelForm))
    if (!json?.channel) return
    setChannels((prev) => [...prev, json.channel])
    setChannelForm({ ...EMPTY_CHANNEL_FORM, categoryKey: channelForm.categoryKey })
  }

  function startEdit(ch: ContentChannel) {
    setEditingChannelId(ch.id)
    setEditForm({
      title: ch.title,
      playlistUrl: ch.playlist_url,
      description: ch.description ?? '',
      categoryKey: ch.category_key,
      thumbnailUrl: ch.thumbnail_url ?? '',
      orderIndex: String(ch.order_index),
    })
  }

  async function saveEdit(id: string) {
    const json = await callApi('/api/admin/content-channels', 'PATCH', { id, ...channelPayload(editForm) })
    if (!json?.channel) return
    setChannels((prev) => prev.map((c) => (c.id === id ? json.channel : c)))
    setEditingChannelId(null)
  }

  async function deleteChannel(id: string) {
    if (!window.confirm('이 채널을 삭제할까요?')) return
    const json = await callApi('/api/admin/content-channels', 'DELETE', { id })
    if (!json?.ok) return
    setChannels((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>
      ) : null}

      {/* ── 카테고리 ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-black text-gray-900">카테고리</h2>
        <ul className="mt-3 flex flex-col gap-1.5">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="font-bold text-gray-800">
                {cat.label} <span className="text-gray-400">({cat.key})</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">순서 {cat.order_index}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteCategory(cat.id)}
                  className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
          <label className="flex flex-col text-xs font-bold text-gray-500">
            key (영문)
            <input
              value={categoryForm.key}
              onChange={(e) => setCategoryForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="self_regulation"
              className="mt-1 w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500">
            이름
            <input
              value={categoryForm.label}
              onChange={(e) => setCategoryForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="자기조절력"
              className="mt-1 w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500">
            순서
            <input
              type="number"
              value={categoryForm.orderIndex}
              onChange={(e) => setCategoryForm((f) => ({ ...f, orderIndex: e.target.value }))}
              className="mt-1 w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy || !categoryForm.key || !categoryForm.label}
            onClick={() => void addCategory()}
            className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            카테고리 추가
          </button>
        </div>
      </section>

      {/* ── 채널 추가 ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-black text-gray-900">채널 추가</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col text-xs font-bold text-gray-500">
            제목
            <input
              value={channelForm.title}
              onChange={(e) => setChannelForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Preschool Prep Company"
              className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500">
            카테고리
            <select
              value={channelForm.categoryKey}
              onChange={(e) => setChannelForm((f) => ({ ...f, categoryKey: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            >
              <option value="">선택</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500 sm:col-span-2">
            유튜브 링크(채널·플레이리스트·영상)
            <input
              value={channelForm.playlistUrl}
              onChange={(e) => setChannelForm((f) => ({ ...f, playlistUrl: e.target.value }))}
              placeholder="https://www.youtube.com/@PreschoolPrepCo"
              className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500 sm:col-span-2">
            소개 문구
            <textarea
              value={channelForm.description}
              onChange={(e) => setChannelForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="알파벳·사이트워드를 신나는 노래로 배워요"
              rows={2}
              className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500">
            썸네일 URL(선택)
            <input
              value={channelForm.thumbnailUrl}
              onChange={(e) => setChannelForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-bold text-gray-500">
            순서
            <input
              type="number"
              value={channelForm.orderIndex}
              onChange={(e) => setChannelForm((f) => ({ ...f, orderIndex: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !channelForm.title || !channelForm.playlistUrl || !channelForm.categoryKey}
          onClick={() => void addChannel()}
          className="mt-3 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          채널 추가
        </button>
      </section>

      {/* ── 카테고리별 채널 목록 ── */}
      {categories.map((cat) => {
        const list = channelsByCategory.get(cat.key) ?? []
        if (list.length === 0) return null
        return (
          <section key={cat.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-base font-black text-gray-900">{cat.label}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {list.map((ch) => (
                <li key={ch.id} className="rounded-xl border border-gray-100 p-3">
                  {editingChannelId === ch.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      />
                      <input
                        value={editForm.playlistUrl}
                        onChange={(e) => setEditForm((f) => ({ ...f, playlistUrl: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      />
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        rows={2}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={editForm.categoryKey}
                          onChange={(e) => setEditForm((f) => ({ ...f, categoryKey: e.target.value }))}
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={editForm.orderIndex}
                          onChange={(e) => setEditForm((f) => ({ ...f, orderIndex: e.target.value }))}
                          className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveEdit(ch.id)}
                          className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingChannelId(null)}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-900">{ch.title}</p>
                        <p className="truncate text-xs text-gray-400">{ch.playlist_url}</p>
                        {ch.description ? (
                          <p className="mt-1 text-xs font-bold text-gray-500">{ch.description}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(ch)}
                          className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteChannel(ch.id)}
                          className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
