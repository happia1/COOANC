'use client'

/**
 * 부모 「알림·공지」시트 안의 공지 목록입니다.
 * - Supabase `notices` 에서 활성 공지만 가져와 세로로 쌓은 블록으로 보여 줍니다.
 * - 접혀 있을 때는 제목만 보이고, 행을 누르면 본문·링크가 토글로 펼쳐집니다.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** DB 한 행과 맞춘 타입 — 컬럼명은 Supabase 스키마와 동일합니다 */
export type ParentNoticeRow = {
  id: string
  title: string
  body: string
  link_url: string | null
  link_label: string | null
  order_index: number
}

type Props = {
  /** 시트가 열려 있을 때만 네트워크 요청을 보냅니다 */
  active: boolean
  /** 링크로 이동하기 직전에 시트를 닫을 때 호출합니다 */
  onClose: () => void
}

async function fetchActiveNotices(): Promise<{ rows: ParentNoticeRow[]; errorMessage: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, body, link_url, link_label, order_index')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) {
    return { rows: [], errorMessage: error.message || '공지를 불러오지 못했어요.' }
  }

  const rows = (data ?? []) as ParentNoticeRow[]
  return { rows, errorMessage: null }
}

/** link_url 이 있을 때만 보이는 버튼 */
function NoticeLinkButton({
  url,
  label,
  onBeforeNavigate,
}: {
  url: string
  label: string | null
  onBeforeNavigate: () => void
}) {
  const router = useRouter()
  const trimmed = url.trim()
  if (!trimmed) return null

  const text = (label && label.trim()) || '바로가기'
  const isExternal = /^https?:\/\//i.test(trimmed)

  if (isExternal) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[#4A90E2] py-2.5 text-xs font-black text-white shadow-sm transition active:scale-[0.98]"
        onClick={() => onBeforeNavigate()}
      >
        {text}
      </a>
    )
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return (
    <button
      type="button"
      className="mt-3 w-full rounded-xl bg-[#4A90E2] py-2.5 text-xs font-black text-white shadow-sm transition active:scale-[0.98]"
      onClick={() => {
        onBeforeNavigate()
        router.push(path)
      }}
    >
      {text}
    </button>
  )
}

/** 접기·펼치기 화살표(비개발자: 열렸을 때 아래를 향함) */
function ChevronDownIcon({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={`${className ?? ''} shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ParentNoticeSlides({ active, onClose }: Props) {
  const [rows, setRows] = useState<ParentNoticeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  /** 펼쳐진 공지 id — 여러 개 동시에 펼칠 수 있습니다 */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!active) return

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    void fetchActiveNotices().then(({ rows: next, errorMessage }) => {
      if (cancelled) return
      setLoading(false)
      if (errorMessage) {
        setFetchError(errorMessage)
        setRows([])
      } else {
        setRows(next)
      }
      setExpandedIds(new Set())
    })

    return () => {
      cancelled = true
    }
  }, [active])

  const toggleRow = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div>
      <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">공지</p>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-[11px] text-gray-500">
          공지를 불러오는 중이에요…
        </div>
      ) : null}

      {!loading && fetchError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-center text-[11px] leading-relaxed text-red-700">
          {fetchError}
        </div>
      ) : null}

      {!loading && !fetchError && rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-[11px] leading-relaxed text-gray-500">
          표시할 공지가 없어요.
        </div>
      ) : null}

      {!loading && !fetchError && rows.length > 0 ? (
        <ul className="flex flex-col gap-2" role="list">
          {rows.map((item) => {
            const expanded = expandedIds.has(item.id)
            const panelId = `notice-panel-${item.id}`
            const headerId = `notice-header-${item.id}`
            return (
              <li key={item.id} className="list-none">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {/*
                    헤더 한 줄: 제목만 노출. 탭하면 아래 상세가 열리고 닫힙니다.
                  */}
                  <button
                    type="button"
                    id={headerId}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleRow(item.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-50/80"
                  >
                    <span className="min-w-0 flex-1 text-xs font-extrabold leading-snug text-gray-900">
                      {item.title}
                    </span>
                    <ChevronDownIcon className="text-gray-400" open={expanded} />
                  </button>
                  {/*
                    펼친 상태에서만 본문·링크 버튼 표시
                  */}
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    hidden={!expanded}
                    className="border-t border-gray-100 px-3 pb-3 pt-2"
                  >
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600">{item.body}</p>
                    {item.link_url ? (
                      <NoticeLinkButton url={item.link_url} label={item.link_label} onBeforeNavigate={onClose} />
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
