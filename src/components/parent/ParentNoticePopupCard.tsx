'use client'

/**
 * 공지 팝업 한 장(앞면·옆면 미리보기) UI.
 * - interactive: 현재 슬라이드만 터치·닫기 동작. 옆 카드도 버튼 영역은 동일하게 그려 둡니다.
 */

import type { RefObject } from 'react'
import type { Notice } from '@/lib/notices'
import { NOTICE_LINK_DEFAULT_LABEL, NOTICE_TYPE_LABELS } from '@/lib/notices'
import NoticeMarkdown from '@/components/common/NoticeMarkdown'
import {
  PARENT_POPUP_BTN,
  PARENT_POPUP_BTN_SOLO,
  PARENT_POPUP_CARD,
} from '@/lib/parentPopupCardStyles'

export type NoticePopupCardProps = {
  notice: Notice
  /** false 면 터치만 막고, 하단 버튼·레이아웃은 그대로 둡니다(슬라이드 시 버튼 깜빡임 방지) */
  interactive?: boolean
  /** true 일 때만 상단 도트 표시 */
  showDots?: boolean
  hasMultiple?: boolean
  index?: number
  total?: number
  isForce?: boolean
  bodyRef?: RefObject<HTMLDivElement | null>
  bodyClamped?: boolean
  dontShowAgain?: boolean
  onClose?: () => void
  onMore?: () => void
  onToggleDontShow?: (checked: boolean) => void
  titleId?: string
}

export default function ParentNoticePopupCard({
  notice,
  interactive = true,
  showDots = false,
  hasMultiple = false,
  index = 0,
  total = 1,
  isForce = false,
  bodyRef,
  bodyClamped = false,
  dontShowAgain = false,
  onClose,
  onMore,
  onToggleDontShow,
  titleId,
}: NoticePopupCardProps) {
  const isImportant = notice.popupType === 'important'
  const typeLabel = NOTICE_TYPE_LABELS[notice.noticeType]
  const link = notice.linkUrl?.trim()
  const linkLabel = (notice.linkLabel && notice.linkLabel.trim()) || NOTICE_LINK_DEFAULT_LABEL
  const isExternalLink = Boolean(link && /^https?:\/\//i.test(link))

  const openExternalLink = () => {
    if (!link || !isExternalLink) return
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`${PARENT_POPUP_CARD} ${isImportant ? 'ring-2 ring-[#4A90E2]' : ''}`}>
      <div
        className={`relative shrink-0 border-b border-gray-100 px-5 pb-3 text-center ${
          hasMultiple && showDots ? 'pt-2.5' : 'pt-5'
        } ${isImportant ? 'bg-[#4A90E2]/5' : 'bg-gray-50/80'}`}
      >
        {interactive && !isForce && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        {hasMultiple && showDots ? (
          <div
            className="mb-1 flex items-center justify-center gap-1"
            role="tablist"
            aria-label={`공지 ${index + 1} / ${total}`}
          >
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                role="tab"
                aria-selected={i === index}
                className={`rounded-full transition-all ${
                  i === index ? 'h-1 w-3 bg-[#4A90E2]' : 'h-1 w-1 bg-gray-300'
                }`}
              />
            ))}
          </div>
        ) : null}

        <span className="mb-1.5 inline-block rounded-full bg-[#4A90E2] px-2.5 py-0.5 text-[10px] font-black text-white">
          {typeLabel}
        </span>
        <h2
          id={titleId}
          className="mx-auto max-w-full px-6 text-center text-base font-black leading-snug text-gray-900"
        >
          {notice.title}
        </h2>
      </div>

      {/* 본문(남는 높이) → 그라데이션 → 더 보기 → 하단 버튼 순 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-2 text-center">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={interactive ? bodyRef : undefined}
            className="h-full w-full overflow-hidden text-center"
          >
            <NoticeMarkdown className="text-xs leading-relaxed text-center [&_blockquote]:border-l-0 [&_blockquote]:px-0 [&_li]:text-center [&_ol]:text-center [&_p]:text-center [&_ul]:text-center">
              {notice.body ?? ''}
            </NoticeMarkdown>
          </div>
          {bodyClamped ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[22px] bg-gradient-to-t from-white/95 via-white/40 to-transparent" />
          ) : null}
        </div>

        {bodyClamped && onMore ? (
          <div className="relative z-10 shrink-0 bg-white py-1.5">
            <button
              type="button"
              onClick={onMore}
              className="inline-flex items-center gap-0.5 text-xs font-black text-[#4A90E2] transition active:scale-[0.98]"
            >
              더 보기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      {onClose ? (
        <div className="relative z-10 shrink-0 bg-white px-5 pb-4 pt-1">
          {link ? (
            <div className="flex gap-2">
              {isExternalLink ? (
                <button
                  type="button"
                  onClick={openExternalLink}
                  className={`${PARENT_POPUP_BTN} bg-[#4A90E2] text-white shadow-sm`}
                >
                  {linkLabel}
                </button>
              ) : (
                <a
                  href={link.startsWith('/') ? link : `/${link}`}
                  className={`${PARENT_POPUP_BTN} bg-[#4A90E2] text-white shadow-sm`}
                >
                  {linkLabel}
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`${PARENT_POPUP_BTN} bg-gray-100 text-gray-700 hover:bg-gray-200`}
              >
                확인
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`${PARENT_POPUP_BTN_SOLO} bg-[#4A90E2] text-white shadow-sm`}
            >
              확인
            </button>
          )}

          {onToggleDontShow ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 pt-1 text-[11px] text-gray-500">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => onToggleDontShow(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[#4A90E2] accent-[#4A90E2]"
              />
              다시 보지 않기
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
