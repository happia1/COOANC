'use client'

/**
 * 앱 실행 시 뜨는 공지 팝업입니다. (STEP 5 / 6 / 7 / 8)
 *
 * 비개발자 설명:
 * - 부모 앱이 처음 켜질 때, 관리자가 "팝업으로 띄우라"고 설정한 공지가 있으면 한 번 보여 줍니다.
 * - 팝업은 한 번에 1개만 보여 주고, 여러 개면 우선순위(force > important > once)로 고릅니다.
 * - 팝업을 닫아도 공지는 사라지지 않고, 종(알림·공지) 안의 공지센터에서 계속 볼 수 있습니다.
 * - 따로 저장(기억)하지 않으므로, 앱을 새로 켜면 조건에 맞는 팝업은 다시 보일 수 있습니다.
 *   (원래 명령문의 shared_preferences 저장은 사용하지 않음 — 웹앱이라 페이지를 새로 열면 재실행으로 봅니다.)
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
  pickLaunchPopupNotice,
  NOTICE_LINK_DEFAULT_LABEL,
  NOTICE_TYPE_LABELS,
  type Notice,
} from '@/lib/notices'
import NoticeMarkdown from '@/components/common/NoticeMarkdown'

/**
 * "이번 앱 실행에서 이미 팝업을 띄웠는지" 기억하는 모듈 전역 플래그.
 * - 클라이언트 화면 이동(SPA)으로 컴포넌트가 다시 mount 돼도 팝업이 또 뜨지 않게 합니다.
 * - 페이지를 통째로 새로고침하면 이 값이 초기화되어 다시 평가합니다(= 새 실행).
 */
let popupHandledThisSession = false

/** "다시 보지 않기"로 끈 팝업 공지 id 를 브라우저에 저장하는 키 (새로고침/재실행해도 유지) */
const DISMISSED_POPUP_STORAGE_KEY = 'cooanc.dismissedPopupIds'

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
  const [notice, setNotice] = useState<Notice | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [entered, setEntered] = useState(false)
  /** "다시 보지 않기" 체크박스 상태 — 새 팝업이 뜰 때마다 초기화됩니다 */
  const [dontShowAgain, setDontShowAgain] = useState(false)
  /** React StrictMode(개발 모드)에서 effect 가 두 번 도는 것을 막는 가드 */
  const startedRef = useRef(false)
  /** 사용자가 닫은 적이 있으면(=null 아님) 실시간 변경으로 자동 재오픈하지 않습니다 */
  const closedIdRef = useRef<string | null>(null)
  /** "다시 보지 않기"로 영구히 끈 공지 id 들 (마운트 시 저장소에서 로드) */
  const dismissedIdsRef = useRef<Set<string>>(new Set())

  /** Realtime 구독용 supabase 클라이언트(한 번만 생성) */
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setPortalReady(true)
    dismissedIdsRef.current = loadDismissedPopupIds()
  }, [])

  /** "다시 보지 않기"로 끈 공지를 제외하고 팝업 1개를 고릅니다 */
  const pickAllowed = useCallback((notices: Notice[]): Notice | null => {
    const allowed = notices.filter((n) => !dismissedIdsRef.current.has(n.id))
    return pickLaunchPopupNotice(allowed)
  }, [])

  /**
   * 최신 공지로 팝업을 다시 계산해 적용합니다.
   * - 떠 있는 동안 내용이 바뀌면 → 그 자리에서 갱신
   * - 노출 대상이 없어지면 → 닫기
   * - 아직 아무것도 안 떴고 사용자가 닫은 적도 없으면 → 새로 띄움
   */
  const applyPicked = useCallback(
    (notices: Notice[]) => {
      const picked = pickAllowed(notices)
      setNotice((prev) => {
        if (!picked) return null
        if (prev) return picked // 이미 열려 있으면 내용/우선순위를 갱신
        if (closedIdRef.current !== null) return prev // 한 번 닫았으면 자동 재오픈 안 함
        return picked
      })
    },
    [pickAllowed],
  )

  // 앱 실행 시 한 번만: 활성 공지를 불러와 팝업 1개를 고릅니다.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (popupHandledThisSession) return
    popupHandledThisSession = true

    let cancelled = false
    void fetchActiveNotices().then(({ notices, errorMessage }) => {
      if (cancelled || errorMessage) return
      const picked = pickAllowed(notices)
      if (picked) setNotice(picked)
    })

    return () => {
      cancelled = true
    }
  }, [pickAllowed])

  // 새 팝업이 뜨면(공지 id 가 바뀌면) "다시 보지 않기" 체크는 초기화합니다.
  useEffect(() => {
    setDontShowAgain(false)
  }, [notice?.id])

  // Realtime: notices 변경(추가/수정/삭제)을 구독해 팝업을 즉시 반영합니다.
  // (관리자가 Supabase Table Editor 에서 고치면 새로고침 없이 팝업 내용이 따라 바뀝니다)
  useEffect(() => {
    const channel = supabase
      .channel('parent-notice-popup-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        void fetchActiveNotices().then(({ notices, errorMessage }) => {
          if (errorMessage) return
          applyPicked(notices)
        })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, applyPicked])

  // 팝업 등장 애니메이션
  useEffect(() => {
    if (!notice) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [notice])

  if (!portalReady || !notice) return null

  const popupType = notice.popupType
  const isImportant = popupType === 'important'
  const isForce = popupType === 'force'

  /** force 가 아니면 바깥(배경) 클릭/X 로 닫을 수 있습니다 */
  const close = () => {
    // 닫은 공지 id 를 기억해, 실시간 변경이 와도 같은 세션에서 자동으로 다시 열지 않게 합니다
    closedIdRef.current = notice.id
    setEntered(false)
    // 퇴장 애니메이션이 끝난 뒤 실제로 제거
    window.setTimeout(() => setNotice(null), 200)
  }

  /** '확인' 버튼: "다시 보지 않기"가 켜져 있으면 이 공지를 영구히 팝업에서 제외하고 닫습니다 */
  const confirmAndClose = () => {
    if (dontShowAgain) {
      const next = new Set(dismissedIdsRef.current)
      next.add(notice.id)
      dismissedIdsRef.current = next
      persistDismissedPopupIds(next)
    }
    close()
  }

  const handleBackdropClick = () => {
    if (isForce) return // force: 바깥 클릭으로 닫기 불가
    close()
  }

  /** 상단 알약 배지에 표시할 공지 종류 라벨 (예: 이벤트 / 사용 가이드 / 공지사항) */
  const typeLabel = NOTICE_TYPE_LABELS[notice.noticeType]

  const link = notice.linkUrl?.trim()
  const linkLabel = (notice.linkLabel && notice.linkLabel.trim()) || NOTICE_LINK_DEFAULT_LABEL

  const overlay = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="parent-notice-popup-title">
      {/* 어두운 배경 */}
      <button
        type="button"
        aria-label={isForce ? undefined : '닫기'}
        disabled={isForce}
        onClick={handleBackdropClick}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'} ${isForce ? 'cursor-default' : ''}`}
      />

      {/* 둥근 다이얼로그 카드 */}
      <div
        className={`relative flex max-h-[85dvh] w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-200 ${
          entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        } ${isImportant ? 'ring-2 ring-[#4A90E2]' : ''}`}
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
            {notice.title}
          </h2>
        </div>

        {/* 본문(마크다운) — 길면 스크롤. 팝업에서는 내용도 가운데 정렬합니다.
            위쪽 여백(pt-4)으로 상단 헤더 블록과 살짝 떨어뜨립니다 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          <NoticeMarkdown className="text-xs leading-relaxed text-center">{notice.body ?? ''}</NoticeMarkdown>
        </div>

        {/* 하단 버튼 영역 */}
        <div className="space-y-2 px-5 pb-5 pt-4">
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

          {/* '확인' 버튼: force 는 이 버튼으로만 닫을 수 있습니다 */}
          <button
            type="button"
            onClick={confirmAndClose}
            className={`w-full rounded-xl py-3 text-sm font-black transition active:scale-[0.98] ${
              link
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-[#4A90E2] text-white shadow-sm'
            }`}
          >
            확인
          </button>

          {/* 확인 버튼 아래: "다시 보지 않기" — 체크 후 확인을 누르면 이 공지는 팝업으로 다시 안 뜨고
              공지센터(종 아이콘)에서만 볼 수 있습니다 */}
          <label className="flex cursor-pointer items-center justify-center gap-2 pt-1 text-[11px] text-gray-500">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-[#4A90E2] accent-[#4A90E2]"
            />
            다시 보지 않기
          </label>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
