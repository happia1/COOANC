'use client'

/**
 * 앱 실행 시 뜨는 공지 팝업입니다. (STEP 5 / 6 / 7 / 8)
 *
 * 비개발자 설명:
 * - 부모 앱이 처음 켜질 때, 관리자가 "팝업으로 띄우라"고 설정한 공지가 있으면 보여 줍니다.
 * - 팝업이 여러 개면, 좌우 스와이프로 슬라이드하며 넘기고 위쪽 도트로 위치를 알 수 있습니다.
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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { fetchActiveNotices, pickLaunchPopupNotices, type Notice } from '@/lib/notices'
import ParentNoticePopupCard from '@/components/parent/ParentNoticePopupCard'
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

/** 슬라이드 넘김 애니메이션 길이(ms) */
const SLIDE_MS = 280

/** DOM 측정 보조 — 본문이 대략 이 높이를 넘기면 잘린 것으로 봅니다 */
const POPUP_BODY_CLAMP_HINT_PX = 120

/** 본문 문자열 기준 — DOM 측정 전에도 긴 글은 더 보기 후보로 봅니다 */
function noticeBodyLikelyClamped(body: string | null | undefined): boolean {
  const text = (body ?? '').trim()
  if (!text) return false
  if (text.length > 180) return true
  if (text.split('\n').length > 4) return true
  return false
}


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
  const dragXRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  /** 스와이프 후 슬라이드 애니메이션 중 */
  const [sliding, setSliding] = useState(false)
  const [cardWidth, setCardWidth] = useState(300)
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
  /** 덱(카드 묶음) 너비 — 넘김 transform 계산에 사용 */
  const deckRef = useRef<HTMLDivElement | null>(null)
  const cardWidthRef = useRef(300)

  const setDragXTracked = useCallback((x: number) => {
    dragXRef.current = x
    setDragX(x)
  }, [])

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
  useLayoutEffect(() => {
    if (!open || !current) {
      setBodyClamped(false)
      return
    }

    const bodyText = current.body ?? ''

    const measure = () => {
      const byText = noticeBodyLikelyClamped(bodyText)
      const node = bodyRef.current
      if (!node) {
        setBodyClamped(byText)
        return
      }
      const byDom =
        node.scrollHeight > node.clientHeight + 2 ||
        (node.clientHeight > 0 && node.scrollHeight > POPUP_BODY_CLAMP_HINT_PX)
      setBodyClamped(byDom || byText)
    }

    measure()
    const rafId = requestAnimationFrame(() => requestAnimationFrame(measure))
    window.addEventListener('resize', measure)

    let ro: ResizeObserver | null = null
    const attachObserver = () => {
      const node = bodyRef.current
      if (!node || ro) return
      ro = new ResizeObserver(measure)
      ro.observe(node)
    }
    attachObserver()
    const retry0 = window.setTimeout(attachObserver, 0)
    const retry1 = window.setTimeout(measure, 80)
    const retry2 = window.setTimeout(measure, 320)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(retry0)
      window.clearTimeout(retry1)
      window.clearTimeout(retry2)
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [open, current?.id, current?.body, entered, index, cardWidth, sliding])

  useEffect(() => {
    const el = deckRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      if (w > 0) {
        cardWidthRef.current = w
        setCardWidth(w)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, entered])

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

  /** 스와이프 확정 — index 를 즉시 바꾸고 트랙만 슬라이드합니다(버튼 영역 딜레이 방지) */
  const completeSlide = useCallback(
    (dir: 1 | -1) => {
      setDragging(false)
      setSliding(true)
      go(dir)
      setDragXTracked(0)
      window.setTimeout(() => setSliding(false), SLIDE_MS)
    },
    [go, setDragXTracked],
  )

  if (!portalReady || !open || !current) return null

  const isForce = current.popupType === 'force'
  const total = notices.length
  const hasMultiple = total > 1
  const trackX = -index * cardWidth + dragX
  const slideTransition =
    sliding || (!dragging && dragX === 0) ? 'transition-transform duration-300 ease-out' : ''

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

  /** 공지별 "다시 보지 않기" 체크 — 슬라이드 중인 카드에도 바로 반영 */
  const toggleDontShowFor = (noticeId: string, checked: boolean) => {
    const next = new Set(markedDontShowRef.current)
    if (checked) next.add(noticeId)
    else next.delete(noticeId)
    markedDontShowRef.current = next
    if (current?.id === noticeId) setDontShowAgain(checked)
  }

  const handleMoreFor = (noticeId: string) => {
    openNoticeCenter(noticeId)
    close()
  }

  // ── 터치(스와이프) 처리 — 세로 스크롤과 충돌하지 않게 방향을 먼저 잠급니다 ──
  const onTouchStart = (e: React.TouchEvent) => {
    if (sliding) return
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
      setDragXTracked(atStart || atEnd ? dx * 0.3 : dx)
    }
  }
  const onTouchEnd = () => {
    const ref = touchRef.current
    const dx = dragXRef.current
    if (ref?.axis === 'h' && !sliding) {
      if (dx <= -SWIPE_THRESHOLD && index < total - 1) {
        completeSlide(1)
        touchRef.current = null
        return
      }
      if (dx >= SWIPE_THRESHOLD && index > 0) {
        completeSlide(-1)
        touchRef.current = null
        return
      }
    }
    setDragXTracked(0)
    setDragging(false)
    touchRef.current = null
  }

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

      {/* 가로 슬라이드 — 스와이프 시 이전·다음 공지가 옆에서 들어옵니다 */}
      <div
        className={`w-full max-w-xs transition-all duration-200 ${
          entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <div
          ref={deckRef}
          className="relative h-[min(22rem,85dvh)] min-h-[22rem] w-full overflow-hidden rounded-2xl"
          style={{ touchAction: 'pan-y' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className={`flex h-full will-change-transform ${slideTransition}`}
            style={{ transform: `translateX(${trackX}px)` }}
          >
            {notices.map((notice, i) => {
              const isActive = i === index
              const dontShow = markedDontShowRef.current.has(notice.id)
              return (
                <div
                  key={notice.id}
                  className={`h-full flex-shrink-0 ${isActive ? '' : 'pointer-events-none'}`}
                  style={{ width: cardWidth > 0 ? cardWidth : '100%' }}
                  aria-hidden={!isActive}
                >
                  <ParentNoticePopupCard
                    notice={notice}
                    interactive={isActive}
                    showDots={isActive}
                    hasMultiple={hasMultiple}
                    index={index}
                    total={total}
                    isForce={notice.popupType === 'force' && isActive}
                    bodyRef={isActive ? bodyRef : undefined}
                    bodyClamped={
                      isActive ? bodyClamped : noticeBodyLikelyClamped(notice.body)
                    }
                    dontShowAgain={dontShow}
                    onClose={close}
                    onMore={() => handleMoreFor(notice.id)}
                    onToggleDontShow={(checked) => toggleDontShowFor(notice.id, checked)}
                    titleId={isActive ? 'parent-notice-popup-title' : undefined}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
