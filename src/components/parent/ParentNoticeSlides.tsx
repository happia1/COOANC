'use client'

/**
 * 부모 「알림·공지」시트 안의 공지 목록입니다.
 * - Supabase `notices` 에서 "현재 노출 대상" 공지만 가져옵니다. (활성 + 노출 기간 조건)
 * - 공지 종류(notice_type)별로 묶어, 카테고리(공지사항/사용 가이드/이벤트/업데이트/안내사항)를
 *   "박스 + 클릭 토글" 형태로 보여 줍니다. 기본은 접혀 있고, 카테고리를 누르면 펼쳐집니다.
 * - 카테고리 안의 개별 공지는 테두리 없는 "리스트" 형태이며, 제목을 누르면 본문(마크다운)·링크가
 *   토글로 펼쳐집니다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  fetchActiveNotices,
  groupNoticesByType,
  NOTICE_LINK_DEFAULT_LABEL,
  type Notice,
  type NoticeType,
} from '@/lib/notices'
import NoticeMarkdown from '@/components/common/NoticeMarkdown'

/** 과거 import 호환용 별칭 — 다른 파일에서 ParentNoticeRow 를 쓰던 경우를 위해 남겨 둡니다 */
export type ParentNoticeRow = Notice

/** "이미 확인한 공지 id" 를 브라우저에 저장하는 키 — 새로고침해도 빨간 도트 상태가 유지됩니다 */
const SEEN_NOTICES_STORAGE_KEY = 'cooanc.seenNoticeIds'

/** 저장소에서 확인한 공지 id 목록을 읽어옵니다 (없거나 깨졌으면 빈 집합) */
function loadSeenNoticeIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(SEEN_NOTICES_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

/** 확인한 공지 id 목록을 저장소에 기록합니다 (실패해도 앱 동작에는 지장 없음) */
function persistSeenNoticeIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SEEN_NOTICES_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* 저장 실패는 무시 */
  }
}

type Props = {
  /** 시트가 열려 있을 때만 네트워크 요청을 보냅니다 */
  active: boolean
  /** 링크로 이동하기 직전에 시트를 닫을 때 호출합니다 */
  onClose: () => void
}

/** link_url 이 있을 때만 보이는 버튼 (STEP 8) */
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

  // 라벨이 비어 있으면 기본 문구('자세히 보기')를 씁니다.
  const text = (label && label.trim()) || NOTICE_LINK_DEFAULT_LABEL
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

/**
 * 공지 한 줄(리스트 항목) — 카테고리 박스 안에서 반복 사용.
 * - 박스 테두리 없이 "리스트" 모양입니다. (항목 사이는 얇은 구분선으로만 나눕니다)
 * - 제목을 누르면 본문(마크다운)·링크가 토글로 펼쳐집니다.
 */
function NoticeListItem({
  item,
  expanded,
  onToggle,
  onClose,
}: {
  item: Notice
  expanded: boolean
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const panelId = `notice-panel-${item.id}`
  const headerId = `notice-header-${item.id}`
  return (
    <li className="list-none">
      {/* 헤더 한 줄: 제목만 노출. 탭하면 아래 상세가 열리고 닫힙니다. */}
      <button
        type="button"
        id={headerId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggle(item.id)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-50/80"
      >
        <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-gray-500">{item.title}</span>
        <ChevronDownIcon className="text-gray-300" open={expanded} />
      </button>
      {/* 펼친 상태에서만 본문(마크다운)·링크 버튼 표시 */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!expanded}
        className="px-3 pb-3 pt-0.5"
      >
        <NoticeMarkdown>{item.body ?? ''}</NoticeMarkdown>
        {item.linkUrl ? (
          <NoticeLinkButton url={item.linkUrl} label={item.linkLabel} onBeforeNavigate={onClose} />
        ) : null}
      </div>
    </li>
  )
}

/**
 * 카테고리 박스(공지사항/사용 가이드/…) — 클릭하면 토글로 펼쳐집니다. 기본은 접힘.
 * - 박스 테두리를 가진 건 "카테고리"이고, 안의 개별 공지는 테두리 없는 리스트입니다.
 */
function NoticeCategoryBox({
  label,
  hasUnread,
  expanded,
  onToggle,
  children,
}: {
  label: string
  /** 카테고리 안에 아직 확인하지 않은 공지가 있는지 — 있으면 빨간 도트 표시 */
  hasUnread: boolean
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-50/80"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-black text-gray-900">{label}</span>
          {/* 아직 확인하지 않은 공지가 있을 때만 빨간 도트로 알려 줍니다 */}
          {hasUnread ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="확인하지 않은 공지 있음" />
          ) : null}
        </span>
      </button>
      {/* 펼친 상태에서만 안쪽 리스트를 보여 줍니다 */}
      <div hidden={!expanded} className="border-t border-gray-100">
        {children}
      </div>
    </div>
  )
}

export default function ParentNoticeSlides({ active, onClose }: Props) {
  const [rows, setRows] = useState<Notice[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  /** 펼쳐진 공지 id — 여러 개 동시에 펼칠 수 있습니다 */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  /** 펼쳐진 카테고리(notice_type) — 기본은 비어 있어 모두 접힌 상태입니다 */
  const [expandedTypes, setExpandedTypes] = useState<Set<NoticeType>>(new Set())
  /** 이미 확인한(한 번 펼쳐 본) 공지 id — 빨간 도트 표시 여부 계산에 씁니다 */
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

  /** 마운트 후 저장소에서 확인 기록을 불러옵니다 (SSR 하이드레이션 불일치 방지) */
  useEffect(() => {
    setSeenIds(loadSeenNoticeIds())
  }, [])

  /** Realtime 구독에 쓸 supabase 클라이언트(한 번만 생성) */
  const supabase = useMemo(() => createClient(), [])

  /** 로딩 스피너 없이 목록만 조용히 다시 받아오는 함수 — Realtime 갱신에 사용 */
  const reloadNotices = useCallback(async () => {
    const { notices: next, errorMessage } = await fetchActiveNotices()
    if (errorMessage) {
      setFetchError(errorMessage)
      setRows([])
    } else {
      setFetchError(null)
      setRows(next)
    }
  }, [])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    void fetchActiveNotices().then(({ notices: next, errorMessage }) => {
      if (cancelled) return
      setLoading(false)
      if (errorMessage) {
        setFetchError(errorMessage)
        setRows([])
      } else {
        setRows(next)
      }
      setExpandedIds(new Set())
      setExpandedTypes(new Set())
    })

    return () => {
      cancelled = true
    }
  }, [active])

  // Realtime: 시트가 열려 있는 동안 notices 변경(추가/수정/삭제)을 구독해 즉시 반영합니다.
  // (관리자가 Supabase Table Editor 에서 고치면 새로고침 없이 화면이 따라 바뀝니다)
  useEffect(() => {
    if (!active) return

    const channel = supabase
      .channel('parent-notices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        void reloadNotices()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [active, supabase, reloadNotices])

  const toggleRow = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // 공지를 한 번이라도 누르면 "확인함"으로 기록 → 빨간 도트 사라짐
    setSeenIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      persistSeenNoticeIds(next)
      return next
    })
  }, [])

  const toggleType = useCallback((type: NoticeType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  // STEP 3: 종류별 섹션으로 묶습니다. 비어 있는 종류는 자동으로 빠집니다.
  const sections = groupNoticesByType(rows)

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

      {!loading && !fetchError && sections.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-[11px] leading-relaxed text-gray-500">
          표시할 공지가 없어요.
        </div>
      ) : null}

      {!loading && !fetchError && sections.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sections.map((section) => (
            <NoticeCategoryBox
              key={section.type}
              label={section.label}
              hasUnread={section.items.some((item) => !seenIds.has(item.id))}
              expanded={expandedTypes.has(section.type)}
              onToggle={() => toggleType(section.type)}
            >
              {/* 카테고리 안: 테두리 없는 리스트(항목 사이 얇은 구분선) */}
              <ul className="divide-y divide-gray-100" role="list">
                {section.items.map((item) => (
                  <NoticeListItem
                    key={item.id}
                    item={item}
                    expanded={expandedIds.has(item.id)}
                    onToggle={toggleRow}
                    onClose={onClose}
                  />
                ))}
              </ul>
            </NoticeCategoryBox>
          ))}
        </div>
      ) : null}
    </div>
  )
}
