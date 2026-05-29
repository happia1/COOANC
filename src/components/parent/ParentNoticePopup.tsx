'use client'

/**
 * 앱 실행 시 뜨는 공지 팝업입니다. (STEP 5 / 6 / 7 / 8)
 *
 * 비개발자 설명:
 * - 부모 앱이 처음 켜질 때, 관리자가 "팝업으로 띄우라"고 설정한 공지가 있으면 보여 줍니다.
 * - 팝업이 여러 개면, 책장을 넘기듯 카드가 살짝 겹쳐진 모습으로 쌓이고
 *   좌우로 밀거나(스와이프) 화살표를 눌러 한 장씩 넘겨 볼 수 있어요.
 * - 표시 순서는 우선순위(force > important > once)로 정렬합니다.
 * - 팝업을 닫아도 공지는 사라지지 않고, 종(알림·공지) 안의 공지센터에서 계속 볼 수 있습니다.
 * - 따로 저장(기억)하지 않으므로, 앱을 새로 켜면 조건에 맞는 팝업은 다시 보일 수 있습니다.
 *   (단, 카드에서 "다시 보지 않기"를 체크한 공지는 닫을 때 영구히 제외됩니다.)
 *
 * 팝업 종류(popup_type)별 동작:
 * - once      : 1회 노출 후 닫으면 끝
 * - important : 강조 스타일로 노출
 * - force     : '확인'을 누르기 전까지 닫기 불가(바깥 클릭/X 비활성화)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import {
  fetchActiveNotices,
  pickLaunchPopupNotices,
  NOTICE_LINK_DEFAULT_LABEL,
  NOTICE_TYPE_LABELS,
  type Notice,
} from '@/lib/notices'
import NoticeMarkdown from '@/components/common/NoticeMarkdown'
import { openNoticeCenter } from '@/lib/noticeCenterBus'

/**
 * "이번 앱 실행에서 이미 팝업을 띄웠는지" 기억하는 모듈 전역 플래그.
 * - 클라이언트 화면 이동(SPA)으로 컴포넌트가 다시 mount 돼도 팝업이 또 뜨지 않게 합니다.
 * - 페이지를 통째로 새로고침하면 이 값이 초기화되어 다시 평가합니다(= 새 실행).
 */
let popupHandledThisSession = false

/** "다시 보지 않기"로 끈 팝업 공지 id 를 브라우저에 저장하는 키 (새로고침/재실행해도 유지) */
const DISMISSED_POPUP_STORAGE_KEY = 'cooanc.dismissedPopupIds'

/** 좌우 스와이프로 "넘김"으로 인정하는 최소 이동 거리(px) */
const SWIPE_THRESHOLD = 50

/** 팝업 본문에 보여 줄 최대 높이(px) — 이보다 길면 잘라 보여 주고 "더 보기"를 띄웁니다 */
const POPUP_BODY_MAX_HEIGHT = 200

/** 저장소에서 "다시 보지 않기" 한 공지 id 목록을 읽어옵니다 */
function loadDismissedPopupIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(DISMISSED_POPUP_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

/** "다시 보지 않기" 한 공지 id 목록을 저장소에 기록합니다 */
function persistDismissedPopupIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISSED_POPUP_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* 저장 실패는 무시 */
  }
}

export default function ParentNoticePopup() {
  /** 현재 팝업으로 띄울 공지 목록(우선순위 정렬). 비어 있으면 팝업을 닫은 상태 */
  const [notices, setNotices] = useState<Notice[]>([])
  /** 지금 보고 있는 카드(공지)의 위치(0부터) */
  const [index, setIndex] = useState(0)
  const [portalReady, setPortalReady] = useState(false)
  const [entered, setEntered] = useState(false)
  /** 손가락으로 끌고 있는 가로 거리(px) — 카드가 손끝을 따라 움직이게 합니다 */
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  /** "다시 보지 않기" 체크박스(현재 카드 기준) 상태 */
  const [dontShowAgain, setDontShowAgain] = useState(false)
  /** 현재 카드 본문이 최대 높이를 넘겨 잘렸는지 — 넘쳤으면 "더 보기"를 보여 줍니다 */
  const [bodyClamped, setBodyClamped] = useState(false)

  /** React StrictMode(개발 모드)에서 effect 가 두 번 도는 것을 막는 가드 */
  const startedRef = useRef(false)
  /** 사용자가 한 번이라도 닫았으면, 실시간 변경이 와도 자동으로 다시 열지 않습니다 */
  const closedRef = useRef(false)
  /** "다시 보지 않기"로 영구히 끈 공지 id 들 (마운트 시 저장소에서 로드) */
  const dismissedIdsRef = useRef<Set<string>>(new Set())
  /** 이번에 보면서 "다시 보지 않기"로 체크한 공지 id 들 — 닫을 때 한꺼번에 저장합니다 */
  const markedDontShowRef = useRef<Set<string>>(new Set())
  /** 터치 시작 좌표 + 가로/세로 방향 잠금 상태(세로 스크롤과 충돌 방지) */
  const touchRef = useRef<{ x: number; y: number; axis: 'h' | 'v' | null } | null>(null)
  /** 본문 영역 DOM — 실제 높이를 재서 "잘림" 여부를 판단합니다 */
  const bodyRef = useRef<HTMLDivElement | null>(null)

  /** Realtime 구독용 supabase 클라이언트(한 번만 생성) */
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setPortalReady(true)
    dismissedIdsRef.current = loadDismissedPopupIds()
  }, [])

  /** "다시 보지 않기"로 끈 공지를 제외하고, 팝업 후보 목록을 우선순위로 정렬해 만듭니다 */
  const pickAllowed = useCallback((all: Notice[]): Notice[] => {
    const allowed = all.filter((n) => !dismissedIdsRef.current.has(n.id))
    return pickLaunchPopupNotices(allowed)
  }, [])

  /**
   * 최신 공지로 팝업 목록을 다시 계산해 적용합니다.
   * - 떠 있는 동안 내용이 바뀌면 → 그 자리에서 목록 갱신(보던 위치는 최대한 유지)
   * - 노출 대상이 없어지면 → 닫기
   * - 아직 아무것도 안 떴고 사용자가 닫은 적도 없으면 → 새로 띄움
   */
  const applyPicked = useCallback(
    (all: Notice[]) => {
      const list = pickAllowed(all)
      setNotices((prev) => {
        if (list.length === 0) return []
        if (prev.length > 0) return list // 이미 열려 있으면 내용/순서만 갱신
        if (closedRef.current) return prev // 한 번 닫았으면 자동 재오픈 안 함
        return list
      })
    },
    [pickAllowed],
  )

  // 앱 실행 시 한 번만: 활성 공지를 불러와 팝업 목록을 만듭니다.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (popupHandledThisSession) return
    popupHandledThisSession = true

    let cancelled = false
    void fetchActiveNotices().then(({ notices: all, errorMessage }) => {
      if (cancelled || errorMessage) return
      const list = pickAllowed(all)
      if (list.length > 0) {
        setNotices(list)
        setIndex(0)
      }
    })

    return () => {
      cancelled = true
    }
  }, [pickAllowed])

  // Realtime: notices 변경(추가/수정/삭제)을 구독해 팝업을 즉시 반영합니다.
  useEffect(() => {
    const channel = supabase
      .channel('parent-notice-popup-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        void fetchActiveNotices().then(({ notices: all, errorMessage }) => {
          if (errorMessage) return
          applyPicked(all)
        })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, applyPicked])

  // 목록 길이가 바뀌면 현재 위치(index)가 범위를 벗어나지 않게 보정합니다.
  useEffect(() => {
    if (notices.length === 0) {
      setIndex(0)
      return
    }
    setIndex((i) => Math.min(i, notices.length - 1))
  }, [notices.length])

  const open = notices.length > 0
  const current = notices[index] ?? null

  // 보고 있는 카드가 바뀌면 "다시 보지 않기" 체크 상태를 그 카드 기준으로 맞춥니다.
  useEffect(() => {
    if (!current) return
    setDontShowAgain(markedDontShowRef.current.has(current.id))
  }, [current?.id])

  // 팝업 등장 애니메이션 (목록이 생기면 부드럽게 나타남)
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  // 현재 카드 본문이 최대 높이를 넘겨 잘렸는지 측정합니다.(넘치면 "더 보기" 노출)
  useEffect(() => {
    if (!open || !current) {
      setBodyClamped(false)
      return
    }
    const measure = () => {
      const el = bodyRef.current
      if (!el) return
      setBodyClamped(el.scrollHeight > el.clientHeight + 4)
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(measure))
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', measure)
    }
  }, [open, current?.id, entered])

  /** 한 장 넘기기(dir: +1 다음, -1 이전) — 범위를 벗어나면 무시 */
  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => {
        const n = i + dir
        if (n < 0 || n >= notices.length) return i
        return n
      })
    },
    [notices.length],
  )

  if (!portalReady || !open || !current) return null

  const popupType = current.popupType
  const isImportant = popupType === 'important'
  const isForce = popupType === 'force'
  const total = notices.length
  const hasMultiple = total > 1

  /** 팝업을 닫습니다. 닫는 순간 "다시 보지 않기"로 체크해 둔 공지들을 영구 제외로 저장합니다. */
  const close = () => {
    if (markedDontShowRef.current.size > 0) {
      const next = new Set(dismissedIdsRef.current)
      markedDontShowRef.current.forEach((id) => next.add(id))
      dismissedIdsRef.current = next
      persistDismissedPopupIds(next)
    }
    closedRef.current = true
    setEntered(false)
    // 퇴장 애니메이션이 끝난 뒤 실제로 제거
    window.setTimeout(() => {
      setNotices([])
      setIndex(0)
      markedDontShowRef.current = new Set()
    }, 200)
  }

  const handleBackdropClick = () => {
    if (isForce) return // force: 바깥 클릭으로 닫기 불가
    close()
  }

  /** "더 보기": 팝업을 닫고, 공지센터를 열어 이 공지의 전체 글을 펼쳐 보여 줍니다 */
  const handleMore = () => {
    openNoticeCenter(current.id)
    close()
  }

  /** 현재 카드의 "다시 보지 않기" 체크를 토글합니다 */
  const toggleDontShow = (checked: boolean) => {
    const next = new Set(markedDontShowRef.current)
    if (checked) next.add(current.id)
    else next.delete(current.id)
    markedDontShowRef.current = next
    setDontShowAgain(checked)
  }

  // ── 터치(스와이프) 처리 — 세로 스크롤과 충돌하지 않게 방향을 먼저 잠급니다 ──
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, axis: null }
    setDragging(true)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const ref = touchRef.current
    if (!ref) return
    const t = e.touches[0]
    const dx = t.clientX - ref.x
    const dy = t.clientY - ref.y
    if (ref.axis === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      ref.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (ref.axis === 'h') {
      // 끝 카드에서 더 끌면 저항감을 주어 살짝만 움직이게 합니다.
      const atStart = index === 0 && dx > 0
      const atEnd = index === total - 1 && dx < 0
      setDragX(atStart || atEnd ? dx * 0.3 : dx)
    }
  }
  const onTouchEnd = () => {
    const ref = touchRef.current
    if (ref?.axis === 'h') {
      if (dragX <= -SWIPE_THRESHOLD && index < total - 1) go(1)
      else if (dragX >= SWIPE_THRESHOLD && index > 0) go(-1)
    }
    setDragX(0)
    setDragging(false)
    touchRef.current = null
  }

  /** 상단 알약 배지에 표시할 공지 종류 라벨 (예: 이벤트 / 사용 가이드 / 공지사항) */
  const typeLabel = NOTICE_TYPE_LABELS[current.noticeType]
  const link = current.linkUrl?.trim()
  const linkLabel = (current.linkLabel && current.linkLabel.trim()) || NOTICE_LINK_DEFAULT_LABEL

  /** 현재 카드 뒤에 "남은 카드 수"만큼(최대 2장) 살짝 겹쳐 보이게 하는 장식 레이어 */
  const remaining = Math.min(total - index - 1, 2)

  const overlay = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-notice-popup-title"
    >
      {/* 어두운 배경 */}
      <button
        type="button"
        aria-label={isForce ? undefined : '닫기'}
        disabled={isForce}
        onClick={handleBackdropClick}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'} ${isForce ? 'cursor-default' : ''}`}
      />

      {/* 책처럼 겹친 카드 더미: 등장 애니메이션은 이 래퍼가 담당합니다 */}
      <div
        className={`relative w-full max-w-xs transition-all duration-200 ${
          entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        {/* 뒤에 쌓인 카드(장식) — 오른쪽 아래로 조금씩 밀려 책장처럼 보이게 합니다 */}
        {Array.from({ length: remaining }).map((_, k) => {
          const depth = k + 1
          return (
            <div
              key={`stack-${k}`}
              aria-hidden
              className="absolute inset-0 rounded-2xl border border-gray-100 bg-white shadow-lg"
              style={{
                transform: `translate(${depth * 8}px, ${depth * 8}px) scale(${1 - depth * 0.04})`,
                zIndex: 0,
                opacity: 1 - depth * 0.15,
              }}
            />
          )
        })}

        {/* 맨 앞(현재) 카드 — 손가락으로 끌면 가로로 움직입니다 */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
            dragging ? '' : 'transition-transform duration-200'
          } ${isImportant ? 'ring-2 ring-[#4A90E2]' : ''}`}
          style={{ transform: `translateX(${dragX}px)`, touchAction: 'pan-y' }}
        >
          {/* 상단: 강조(important)면 파란 띠, 그 외는 단정한 헤더 — 내용은 가운데 정렬 */}
          <div className={`relative px-5 pb-3 pt-5 text-center ${isImportant ? 'bg-[#4A90E2]/5' : ''}`}>
            {/* force 가 아닐 때만 X 버튼 노출 — 우상단에 고정해 제목 중앙정렬을 방해하지 않습니다 */}
            {!isForce ? (
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
            {/* 상단 알약 배지: 공지 종류(notice_type)에 맞춘 라벨을 보여 줍니다 */}
            <span className="mb-2 inline-block rounded-full bg-[#4A90E2] px-2.5 py-0.5 text-[10px] font-black text-white">
              {typeLabel}
            </span>
            <h2 id="parent-notice-popup-title" className="px-6 text-base font-black leading-snug text-gray-900">
              {current.title}
            </h2>
          </div>

          {/* 본문(마크다운) — 일정 분량만 보여 주고, 길면 아래에 "더 보기"로 공지센터로 연결합니다. */}
          <div className="relative px-5 pt-4">
            <div ref={bodyRef} className="overflow-hidden" style={{ maxHeight: POPUP_BODY_MAX_HEIGHT }}>
              <NoticeMarkdown className="text-xs leading-relaxed text-center">{current.body ?? ''}</NoticeMarkdown>
            </div>
            {/* 잘렸을 때만: 아래쪽을 흐리게(페이드) 처리해 글이 "이어진다"는 느낌을 줍니다 */}
            {bodyClamped ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
            ) : null}
          </div>

          {/* 본문이 잘렸으면: 공지센터에서 전체 글을 바로 볼 수 있는 "더 보기" */}
          {bodyClamped ? (
            <div className="px-5 pt-2 text-center">
              <button
                type="button"
                onClick={handleMore}
                className="inline-flex items-center gap-0.5 text-xs font-black text-[#4A90E2] transition active:scale-[0.98]"
              >
                더 보기
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : null}

          {/* 여러 장이면: 좌우 화살표 + 점(현재 위치) 표시로 넘겨 볼 수 있게 합니다 */}
          {hasMultiple ? (
            <div className="flex items-center justify-center gap-3 px-5 pt-3">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                aria-label="이전 공지"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors enabled:hover:bg-gray-100 enabled:hover:text-gray-700 disabled:opacity-30"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="flex items-center gap-1.5">
                {notices.map((n, i) => (
                  <span
                    key={n.id}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-4 bg-[#4A90E2]' : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => go(1)}
                disabled={index === total - 1}
                aria-label="다음 공지"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors enabled:hover:bg-gray-100 enabled:hover:text-gray-700 disabled:opacity-30"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : null}

          {/* 하단 버튼 영역 */}
          <div className="space-y-2 px-5 pb-5 pt-3">
            {link ? (
              /^https?:\/\//i.test(link) ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl bg-[#4A90E2] py-3 text-center text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
                >
                  {linkLabel}
                </a>
              ) : (
                <a
                  href={link.startsWith('/') ? link : `/${link}`}
                  className="block w-full rounded-xl bg-[#4A90E2] py-3 text-center text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
                >
                  {linkLabel}
                </a>
              )
            ) : null}

            {/* '확인' 버튼: 팝업 전체를 닫습니다 (force 는 이 버튼으로만 닫을 수 있어요) */}
            <button
              type="button"
              onClick={close}
              className={`w-full rounded-xl py-3 text-sm font-black transition active:scale-[0.98] ${
                link ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-[#4A90E2] text-white shadow-sm'
              }`}
            >
              확인
            </button>

            {/* "다시 보지 않기" — 체크 후 닫으면 이 공지는 팝업으로 다시 안 뜨고
                공지센터(종 아이콘)에서만 볼 수 있습니다 (현재 보고 있는 카드 기준) */}
            <label className="flex cursor-pointer items-center justify-center gap-2 pt-1 text-[11px] text-gray-500">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => toggleDontShow(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[#4A90E2] accent-[#4A90E2]"
              />
              다시 보지 않기
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
